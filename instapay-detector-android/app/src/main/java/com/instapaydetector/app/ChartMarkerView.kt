package com.instapaydetector.app

import android.content.Context
import android.widget.TextView
import com.github.mikephil.charting.components.MarkerView
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.highlight.Highlight
import com.github.mikephil.charting.utils.MPPointF
import java.text.SimpleDateFormat
import java.util.Locale

class ChartMarkerView(
    context: Context,
    layoutResource: Int,
    private val chartPoints: List<ChartPoint>
) : MarkerView(context, layoutResource) {

    private val tvDate: TextView = findViewById(R.id.tvMarkerDate)
    private val tvValue: TextView = findViewById(R.id.tvMarkerValue)
    private val tvCount: TextView = findViewById(R.id.tvMarkerCount)

    override fun refreshContent(e: Entry?, highlight: Highlight?) {
        if (e == null) return
        val index = e.x.toInt()
        if (index in chartPoints.indices) {
            val point = chartPoints[index]
            try {
                val parts = point.date.split("-")
                val fmt = SimpleDateFormat("MMM d, yyyy", Locale.US)
                val cal = java.util.GregorianCalendar(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
                tvDate.text = fmt.format(cal.time)
            } catch (_: Exception) {
                tvDate.text = point.date
            }
            tvValue.text = "EGP ${String.format(Locale.US, "%,.2f", point.totalEgp)}"
            tvCount.text = "${point.count} payment${if (point.count != 1) "s" else ""}"
        }
        super.refreshContent(e, highlight)
    }

    override fun getOffset(): MPPointF {
        return MPPointF(-(width / 2f), -height.toFloat() - 15f)
    }
}
