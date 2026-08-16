package com.instapaydetector.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Exports a list of transactions to a CSV file and opens the system
 * share sheet so the merchant can send it via email, WhatsApp, Drive, etc.
 *
 * CSV columns: Date, Sender, Amount, Currency, Status, Reference, Note, Session ID
 */
object CsvExporter {

    fun export(context: Context, transactions: List<Transaction>): Boolean {
        if (transactions.isEmpty()) {
            Toast.makeText(context, "No transactions to export", Toast.LENGTH_SHORT).show()
            return false
        }

        val timestamp = SimpleDateFormat("yyyy-MM-dd_HH-mm", Locale.US).format(Date())
        val fileName = "instapay-transactions-$timestamp.csv"

        return try {
            // Write to app's cache dir so we don't need storage permission
            val cacheDir = File(context.cacheDir, "exports")
            cacheDir.mkdirs()
            val file = File(cacheDir, fileName)

            FileWriter(file).use { writer ->
                writer.append("Date,Sender,Amount,Currency,Status,Reference,Note,Session ID\n")
                for (t in transactions) {
                    val date = t.detectedAt ?: t.createdAt
                    writer.append(escape(date))
                    writer.append(",")
                    writer.append(escape(t.senderHandle))
                    writer.append(",")
                    writer.append(String.format(Locale.US, "%.2f", t.amountEgp))
                    writer.append(",")
                    writer.append(escape(t.currency))
                    writer.append(",")
                    writer.append(escape(t.status))
                    writer.append(",")
                    writer.append(escape(t.detectedRef ?: ""))
                    writer.append(",")
                    writer.append(escape(t.note ?: ""))
                    writer.append(",")
                    writer.append(escape(t.sessionId))
                    writer.append("\n")
                }
                writer.flush()
            }

            // Share via FileProvider
            val uri = FileProvider.getUriForFile(
                context,
                context.packageName + ".fileprovider",
                file
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "InstaPay transactions export ($timestamp)")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            context.startActivity(Intent.createChooser(shareIntent, "Export transactions"))

            Toast.makeText(context, "Exported ${transactions.size} transactions", Toast.LENGTH_SHORT).show()
            true
        } catch (e: Exception) {
            Toast.makeText(context, "Export failed: ${e.message}", Toast.LENGTH_LONG).show()
            false
        }
    }

    private fun escape(value: String): String {
        // RFC 4180: wrap in quotes if contains comma/quote/newline, escape quotes by doubling
        return if (value.contains(',') || value.contains('"') || value.contains('\n')) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
    }
}
