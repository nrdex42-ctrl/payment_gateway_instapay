package com.instapaydetector.app

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.DialogFragment
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.Date
import java.util.TimeZone

/**
 * Bottom-sheet-style dialog showing full transaction details when a
 * merchant taps a row in the transactions list.
 */
class TransactionDetailDialog : DialogFragment() {

    var onStatusChanged: ((Transaction) -> Unit)? = null

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
                detectedAmountEgp = if (it.containsKey("detectedAmountEgp")) it.getDouble("detectedAmountEgp") else null,
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

        var currentTx = tx

        val detailTitle = view.findViewById<TextView>(R.id.detailTitle)
        val detailStatus = view.findViewById<TextView>(R.id.detailStatus)
        val txtConfirmedBadge = view.findViewById<TextView>(R.id.txtConfirmedBadge)
        val btnConfirmTx = view.findViewById<MaterialButton>(R.id.btnConfirmTx)
        val btnExpireTx = view.findViewById<MaterialButton>(R.id.btnExpireTx)
        val btnCancelTx = view.findViewById<MaterialButton>(R.id.btnCancelTx)

        fun updateUIStatus(newStatus: String) {
            currentTx = currentTx.copy(status = newStatus)
            detailStatus.text = newStatus
            detailTitle.text = "${newStatus.lowercase().replaceFirstChar { it.uppercase() }} payment"

            when (newStatus) {
                "CONFIRMED" -> {
                    txtConfirmedBadge.visibility = View.VISIBLE
                    btnConfirmTx.visibility = View.GONE
                    btnExpireTx.visibility = View.GONE
                    btnCancelTx.visibility = View.GONE
                }
                "EXPIRED" -> {
                    txtConfirmedBadge.visibility = View.GONE
                    btnConfirmTx.visibility = View.VISIBLE
                    btnExpireTx.visibility = View.GONE
                    btnCancelTx.visibility = View.GONE
                }
                "CANCELLED" -> {
                    txtConfirmedBadge.visibility = View.GONE
                    btnConfirmTx.visibility = View.VISIBLE
                    btnExpireTx.visibility = View.GONE
                    btnCancelTx.visibility = View.GONE
                }
                else -> { // PENDING or UNDERPAID
                    txtConfirmedBadge.visibility = View.GONE
                    btnConfirmTx.visibility = View.VISIBLE
                    btnExpireTx.visibility = View.VISIBLE
                    btnCancelTx.visibility = View.VISIBLE
                }
            }
        }

        view.findViewById<TextView>(R.id.detailFrom).text = currentTx.senderHandle
        view.findViewById<TextView>(R.id.detailTo).text = currentTx.recipientHandle
        
        val amountStr = if (currentTx.detectedAmountEgp != null && currentTx.detectedAmountEgp!! > currentTx.amountEgp) {
            "${String.format(Locale.US, "%,.2f", currentTx.detectedAmountEgp)} ${currentTx.currency} (Overpaid • Req: ${String.format(Locale.US, "%,.2f", currentTx.amountEgp)})"
        } else {
            "${String.format(Locale.US, "%,.2f", currentTx.amountEgp)} ${currentTx.currency}"
        }
        view.findViewById<TextView>(R.id.detailAmount).text = amountStr
        view.findViewById<TextView>(R.id.detailReference).text = currentTx.detectedRef ?: "—"
        view.findViewById<TextView>(R.id.detailDate).text = formatDate(currentTx.detectedAt ?: currentTx.createdAt)
        view.findViewById<TextView>(R.id.detailNote).text = currentTx.note ?: "—"
        view.findViewById<TextView>(R.id.detailSession).text = currentTx.sessionId

        updateUIStatus(currentTx.status)

        btnConfirmTx.setOnClickListener {
            btnConfirmTx.isEnabled = false
            kotlinx.coroutines.MainScope().launch {
                val client = DashboardApiClient(requireContext())
                val res = client.updateTransactionStatus(currentTx.sessionId, "CONFIRMED", "APK_MANUAL_FIX")
                btnConfirmTx.isEnabled = true
                if (res.isSuccess) {
                    updateUIStatus("CONFIRMED")
                    onStatusChanged?.invoke(currentTx)
                    android.widget.Toast.makeText(requireContext(), R.string.tx_status_updated, android.widget.Toast.LENGTH_SHORT).show()
                } else {
                    android.widget.Toast.makeText(requireContext(), R.string.tx_status_update_failed, android.widget.Toast.LENGTH_LONG).show()
                }
            }
        }

        btnExpireTx.setOnClickListener {
            btnExpireTx.isEnabled = false
            kotlinx.coroutines.MainScope().launch {
                val client = DashboardApiClient(requireContext())
                val res = client.updateTransactionStatus(currentTx.sessionId, "EXPIRED")
                btnExpireTx.isEnabled = true
                if (res.isSuccess) {
                    updateUIStatus("EXPIRED")
                    onStatusChanged?.invoke(currentTx)
                    android.widget.Toast.makeText(requireContext(), R.string.tx_status_updated, android.widget.Toast.LENGTH_SHORT).show()
                } else {
                    android.widget.Toast.makeText(requireContext(), R.string.tx_status_update_failed, android.widget.Toast.LENGTH_LONG).show()
                }
            }
        }

        btnCancelTx.setOnClickListener {
            btnCancelTx.isEnabled = false
            kotlinx.coroutines.MainScope().launch {
                val client = DashboardApiClient(requireContext())
                val res = client.updateTransactionStatus(currentTx.sessionId, "CANCELLED")
                btnCancelTx.isEnabled = true
                if (res.isSuccess) {
                    updateUIStatus("CANCELLED")
                    onStatusChanged?.invoke(currentTx)
                    android.widget.Toast.makeText(requireContext(), R.string.tx_status_updated, android.widget.Toast.LENGTH_SHORT).show()
                } else {
                    android.widget.Toast.makeText(requireContext(), R.string.tx_status_update_failed, android.widget.Toast.LENGTH_LONG).show()
                }
            }
        }

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
                    if (tx.detectedAmountEgp != null) {
                        putDouble("detectedAmountEgp", tx.detectedAmountEgp)
                    }
                }
            }
        }
    }
}
