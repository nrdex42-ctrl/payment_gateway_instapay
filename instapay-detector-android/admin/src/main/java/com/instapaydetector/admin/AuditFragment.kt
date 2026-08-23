package com.instapaydetector.admin

import org.json.JSONObject

class AuditFragment : AdminLogListFragment() {
    override val titleText = "Audit"
    override val subtitleText = "Administrative action history."
    override val emptyText = "No audit logs found."
    override val endpoint = "/api/admin/audit?limit=50"
    override val arrayKey = "logs"

    override fun mapItem(item: JSONObject): AdminLogEntry {
        return AdminLogEntry(
            title = item.optString("action"),
            subtitle = item.optString("details"),
            meta = item.optString("createdAt"),
            badge = "AUDIT",
            tone = AdminLogTone.NEUTRAL
        )
    }
}
