# Project-specific ProGuard rules for the InstaPay admin APK.
# Keep the admin package and view-binding generated classes intact.
-keep class com.instapaydetector.admin.** { *; }
-keep class androidx.viewbinding.** { *; }
