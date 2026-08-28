package com.instapaydetector.admin

import org.json.JSONArray
import org.json.JSONObject

class WebhooksFragment : AdminLogListFragment() {
    override val titleText = "Webhooks"
    override val subtitleText = "Delivery success, failures, payload URLs."
    override val emptyText = "No webhook logs found."
    override val endpoint = "/api/admin/webhooks?limit=50"
    override val arrayKey = "logs"

    override fun mapItem(item: JSONObject): AdminLogEntry {
        val success = item.optBoolean("isSuccess", false)
        val status = if (success) "SUCCESS" else "ERROR"
        return AdminLogEntry(
            title = "${item.optString("businessName")} · ${item.optString("event")}",
            subtitle = item.optString("url"),
            meta = "${item.optInt("statusCode", 0)} • ${item.optString("createdAt")}",
            badge = status,
            tone = if (success) AdminLogTone.SUCCESS else AdminLogTone.ERROR
        )
    }
}
