package night.party.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 「时间到」提醒震动：以 USAGE_ALARM 触发，不受系统「触感反馈」总开关影响。
 *
 * 背景：Android WebView 的 navigator.vibrate() 返回 true 但不驱动马达；@capacitor/haptics
 * 走系统默认的 TOUCH 用法，触感反馈关闭时会被系统以 ignored_for_settings 丢弃。提醒类反馈
 * 需要 alarm 用法才能稳定驱动马达，故自建一个最小原生插件。
 */
@CapacitorPlugin(name = "AlertVibrate")
public class AlertVibratePlugin extends Plugin {
    // Android 波形从「关」开始：0 延时 → 震 120 → 停 60 → 震 120
    private static final long[] PATTERN = { 0, 120, 60, 120 };

    @PluginMethod
    public void vibrate(PluginCall call) {
        vibratePattern();
        call.resolve();
    }

    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager != null ? manager.getDefaultVibrator() : null;
        }
        return (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }

    @SuppressWarnings("deprecation")
    private void vibratePattern() {
        Vibrator vibrator = vibrator();
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            vibrator.vibrate(
                VibrationEffect.createWaveform(PATTERN, -1),
                VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM)
            );
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(PATTERN, -1));
        } else {
            vibrator.vibrate(PATTERN, -1);
        }
    }
}