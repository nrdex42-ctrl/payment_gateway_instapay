package com.instapaydetector.app

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.DialogFragment
import com.google.android.material.button.MaterialButton
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.Date
import java.util.TimeZone

/**
 * Bottom-sheet-style dialog showing full transaction details when a
 * merchant taps a row in the transactions list.
 */
class TransactionDetailDialog : DialogFragment() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NO_TITLE, android.R.style.Theme_Material_Light_Dialog_MinWidth)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.dialog_transaction_detail, container, false)

        val tx = arguments?.let {
            // Reconstruct from args
            Transaction(
                sessionId = it.getString("sessionId", ""),
                senderHandle = it.getString("senderHandle", ""),
                recipientHandle = it.getString("recipientHandle", ""),
                amountEgp = it.getDouble("amountEgp", 0.0),
                currency = it.getString("currency", "EGP"),
                status = it.getString("status", ""),
                note = it.getString("note"),
                deepLinkUrl = it.getString("deepLinkUrl"),
                deepLinkToken = it.getString("deepLinkToken"),
                detectedRef = it.getString("detectedRef"),
                detectedAt = it.getString("detectedAt"),
                createdAt = it.getString("createdAt", ""),
                expiresAt = it.getString("expiresAt", ""),
            )
        } ?: run {
            dismiss()
            return view
        }

        view.findViewById<TextView>(R.id.detailTitle).text = "${tx.status.lowercase().replaceFirstChar { it.uppercase() }} payment"
        view.findViewById<TextView>(R.id.detailFrom).text = tx.senderHandle
        view.findViewById<TextView>(R.id.detailTo).text = tx.recipientHandle
        view.findViewById<TextView>(R.id.detailAmount).text = "${String.format(Locale.US, "%,.2f", tx.amountEgp)} ${tx.currency}"
        view.findViewById<TextView>(R.id.detailStatus).text = tx.status
        view.findViewById<TextView>(R.id.detailReference).text = tx.detectedRef ?: "—"
        view.findViewById<TextView>(R.id.detailDate).text = formatDate(tx.detectedAt ?: tx.createdAt)
        view.findViewById<TextView>(R.id.detailNote).text = tx.note ?: "—"
        view.findViewById<TextView>(R.id.detailSession).text = tx.sessionId

        view.findViewById<MaterialButton>(R.id.closeButton).setOnClickListener { dismiss() }

        return view
    }

    private fun formatDate(iso: String): String {
        return try {
            val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val output = SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.US).apply {
                timeZone = TimezoneManager.getTimeZone(requireContext())
            }
            val date = input.parse(iso) ?: Date()
            output.format(date)
        } catch (_: Exception) {
            try {
                val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val output = SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.US).apply {
                    timeZone = TimezoneManager.getTimeZone(requireContext())
                }
                val date = input.parse(iso) ?: Date()
                output.format(date)
            } catch (_: Exception) {
                iso
            }
        }
    }

    companion object {
        fun newInstance(tx: Transaction): TransactionDetailDialog {
            return TransactionDetailDialog().apply {
                arguments = Bundle().apply {
                    putString("sessionId", tx.sessionId)
                    putString("senderHandle", tx.senderHandle)
                    putString("recipientHandle", tx.recipientHandle)
                    putDouble("amountEgp", tx.amountEgp)
                    putString("currency", tx.currency)
                    putString("status", tx.status)
                    putString("note", tx.note)
                    putString("deepLinkUrl", tx.deepLinkUrl)
                    putString("deepLinkToken", tx.deepLinkToken)
                    putString("detectedRef", tx.detectedRef)
                    putString("detectedAt", tx.detectedAt)
                    putString("createdAt", tx.createdAt)
                    putString("expiresAt", tx.expiresAt)
                }
            }
        }
    }
}
