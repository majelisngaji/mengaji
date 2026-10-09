package com.mrobbie.majelismengaji;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.Locale;

public class QiblaActivity extends Activity implements SensorEventListener, LocationListener {
    private static final int REQ_LOCATION = 7001;
    private static final double KAABA_LAT = 21.422487;
    private static final double KAABA_LON = 39.826206;

    private SensorManager sensorManager;
    private Sensor rotationVectorSensor;
    private Sensor accelerometer;
    private Sensor magnetometer;
    private LocationManager locationManager;

    private final float[] rotation = new float[9];
    private final float[] orientation = new float[3];
    private float[] accel;
    private float[] magnetic;

    private Location location;
    private Double qiblaBearing;
    private Double trueHeading;
    private double smoothedHeading = Double.NaN;
    private int sensorAccuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;

    private CompassView compass;
    private TextView status;
    private TextView qiblaLabel;
    private TextView headingLabel;
    private TextView locationLabel;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(14, 77, 55));
        getWindow().setNavigationBarColor(Color.rgb(246, 242, 232));

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);

        buildUi();
        ensureLocation();
    }

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private TextView text(String value, float sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setGravity(Gravity.CENTER);
        v.setPadding(dp(8), dp(4), dp(8), dp(4));
        if (bold) v.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return v;
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(246, 242, 232));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(16), dp(10), dp(16), dp(28));
        scroll.addView(root, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);

        Button back = new Button(this);
        back.setText("‹");
        back.setTextSize(28);
        back.setTextColor(Color.rgb(14, 77, 55));
        back.setBackgroundColor(Color.TRANSPARENT);
        back.setOnClickListener(v -> finish());
        top.addView(back, new LinearLayout.LayoutParams(dp(52), dp(52)));

        TextView title = text("Kompas Kiblat", 23, Color.rgb(14, 77, 55), true);
        title.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        top.addView(title, new LinearLayout.LayoutParams(0, dp(52), 1f));
        root.addView(top, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        status = text("Membaca lokasi dan sensor kompas…", 14, Color.rgb(74, 92, 83), false);
        root.addView(status, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        compass = new CompassView(this);
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(370));
        cp.setMargins(0, dp(8), 0, dp(8));
        root.addView(compass, cp);

        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.HORIZONTAL);
        qiblaLabel = text("Arah Kiblat\n—", 17, Color.rgb(14, 77, 55), true);
        headingLabel = text("Arah HP\n—", 17, Color.rgb(14, 77, 55), true);
        info.addView(qiblaLabel, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        info.addView(headingLabel, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        root.addView(info, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        locationLabel = text("Lokasi: menunggu GPS…", 13, Color.rgb(95, 111, 103), false);
        root.addView(locationLabel, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView note = text(
                "Letakkan HP mendatar dan jauhkan dari benda bermagnet. Panah hanya ditampilkan bila GPS dan sensor kompas native Android tersedia.",
                13, Color.rgb(95, 111, 103), false);
        note.setPadding(dp(14), dp(10), dp(14), dp(10));
        root.addView(note, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button retry = new Button(this);
        retry.setText("Baca Ulang Sensor");
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(16);
        retry.setBackgroundColor(Color.rgb(14, 77, 55));
        retry.setOnClickListener(v -> {
            smoothedHeading = Double.NaN;
            trueHeading = null;
            status.setText("Membaca ulang lokasi dan sensor kompas…");
            startLocation();
            startSensors();
        });
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        rp.setMargins(0, dp(8), 0, 0);
        root.addView(retry, rp);

        setContentView(scroll);
    }

    private void ensureLocation() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startLocation();
        } else {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, REQ_LOCATION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != REQ_LOCATION) return;
        boolean granted = false;
        for (int r : results) if (r == PackageManager.PERMISSION_GRANTED) granted = true;
        if (granted) startLocation();
        else {
            status.setText("Izin lokasi diperlukan untuk menghitung arah Ka'bah.");
            compass.setReady(false);
        }
    }

    private void startLocation() {
        if (locationManager == null) return;
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        try {
            Location best = null;
            Location gps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location net = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (gps != null) best = gps;
            if (net != null && (best == null || net.getTime() > best.getTime())) best = net;
            if (best != null) onLocationChanged(best);
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000L, 0f, this);
            }
        } catch (SecurityException e) {
            status.setText("Izin lokasi belum tersedia.");
        }
    }

    private void startSensors() {
        if (sensorManager == null) return;
        sensorManager.unregisterListener(this);
        if (rotationVectorSensor != null) {
            sensorManager.registerListener(this, rotationVectorSensor, SensorManager.SENSOR_DELAY_GAME);
        } else if (accelerometer != null && magnetometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
            sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_GAME);
        } else {
            status.setText("Perangkat ini tidak memiliki sensor kompas/magnetometer.");
            compass.setReady(false);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        startSensors();
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startLocation();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (sensorManager != null) sensorManager.unregisterListener(this);
        if (locationManager != null) {
            try { locationManager.removeUpdates(this); } catch (SecurityException ignored) {}
        }
    }

    @Override
    public void onLocationChanged(Location newLocation) {
        if (newLocation == null) return;
        if (location == null ||
                newLocation.getAccuracy() <= location.getAccuracy() * 1.5f ||
                newLocation.getTime() > location.getTime()) {
            location = newLocation;
        }
        qiblaBearing = bearingToKaaba(location.getLatitude(), location.getLongitude());
        locationLabel.setText(String.format(Locale.US,
                "Lokasi: %.5f, %.5f • akurasi ±%.0f m",
                location.getLatitude(), location.getLongitude(), location.getAccuracy()));
        updateUi();
    }

    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int state, Bundle extras) {}

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.sensor == null) return;
        sensorAccuracy = event.accuracy;

        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(rotation, event.values);
            SensorManager.getOrientation(rotation, orientation);
            setMagneticHeading(Math.toDegrees(orientation[0]));
            return;
        }

        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            accel = event.values.clone();
        } else if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            magnetic = event.values.clone();
        }

        if (accel != null && magnetic != null &&
                SensorManager.getRotationMatrix(rotation, null, accel, magnetic)) {
            SensorManager.getOrientation(rotation, orientation);
            setMagneticHeading(Math.toDegrees(orientation[0]));
        }
    }

    private void setMagneticHeading(double magneticHeading) {
        double h = normalize(magneticHeading);
        if (location != null) {
            float altitude = location.hasAltitude() ? (float) location.getAltitude() : 0f;
            GeomagneticField field = new GeomagneticField(
                    (float) location.getLatitude(),
                    (float) location.getLongitude(),
                    altitude,
                    System.currentTimeMillis());
            h = normalize(h + field.getDeclination());
        }
        if (Double.isNaN(smoothedHeading)) smoothedHeading = h;
        else smoothedHeading = normalize(smoothedHeading + shortestDelta(smoothedHeading, h) * 0.20);
        trueHeading = smoothedHeading;
        updateUi();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        sensorAccuracy = accuracy;
        updateUi();
    }

    private void updateUi() {
        qiblaLabel.setText(qiblaBearing == null ? "Arah Kiblat\n—" :
                String.format(Locale.US, "Arah Kiblat\n%.0f°", qiblaBearing));
        headingLabel.setText(trueHeading == null ? "Arah HP\n—" :
                String.format(Locale.US, "Arah HP\n%.0f°", trueHeading));

        boolean ready = qiblaBearing != null && trueHeading != null;
        if (!ready) {
            compass.setReady(false);
            if (qiblaBearing == null) status.setText("Menunggu lokasi GPS…");
            else status.setText("Lokasi terbaca. Menunggu sensor kompas native Android…");
            return;
        }

        double relative = normalize(qiblaBearing - trueHeading);
        compass.setData(trueHeading, relative, true);

        if (sensorAccuracy == SensorManager.SENSOR_STATUS_UNRELIABLE) {
            status.setText("Sensor kompas belum stabil. Jangan gunakan arah ini sebagai patokan sampai sensor stabil.");
            return;
        }

        double diff = Math.min(relative, 360.0 - relative);
        if (diff <= 4.0) status.setText("Arah HP sudah menghadap Kiblat");
        else status.setText("Putar HP perlahan sampai panah Ka'bah lurus ke atas");
    }

    private static double bearingToKaaba(double lat, double lon) {
        double p1 = Math.toRadians(lat);
        double p2 = Math.toRadians(KAABA_LAT);
        double dl = Math.toRadians(KAABA_LON - lon);
        double y = Math.sin(dl) * Math.cos(p2);
        double x = Math.cos(p1) * Math.sin(p2) -
                Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
        return normalize(Math.toDegrees(Math.atan2(y, x)));
    }

    private static double normalize(double value) {
        value %= 360.0;
        if (value < 0) value += 360.0;
        return value;
    }

    private static double shortestDelta(double from, double to) {
        return ((to - from + 540.0) % 360.0) - 180.0;
    }

    private static final class CompassView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path arrow = new Path();
        private boolean ready;
        private double heading;
        private double relative;

        CompassView(Context context) {
            super(context);
            textPaint.setTextAlign(Paint.Align.CENTER);
            textPaint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        }

        void setData(double heading, double relative, boolean ready) {
            this.heading = heading;
            this.relative = relative;
            this.ready = ready;
            invalidate();
        }

        void setReady(boolean ready) {
            this.ready = ready;
            invalidate();
        }

        private float dp(float v) {
            return v * getResources().getDisplayMetrics().density;
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float w = getWidth(), h = getHeight();
            float cx = w / 2f, cy = h / 2f;
            float r = Math.min(w, h) * 0.39f;

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.rgb(255, 252, 245));
            canvas.drawCircle(cx, cy, r + dp(12), paint);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(2));
            paint.setColor(Color.rgb(218, 201, 157));
            canvas.drawCircle(cx, cy, r, paint);

            canvas.save();
            if (ready) canvas.rotate((float) -heading, cx, cy);
            for (int i = 0; i < 72; i++) {
                double a = Math.toRadians(i * 5.0 - 90.0);
                float x1 = cx + (float) Math.cos(a) * r;
                float y1 = cy + (float) Math.sin(a) * r;
                float len = i % 18 == 0 ? dp(14) : (i % 9 == 0 ? dp(9) : dp(5));
                float x2 = cx + (float) Math.cos(a) * (r - len);
                float y2 = cy + (float) Math.sin(a) * (r - len);
                paint.setStrokeWidth(i % 18 == 0 ? dp(2.5f) : dp(1));
                paint.setColor(i == 0 ? Color.rgb(181, 139, 39) : Color.rgb(126, 139, 131));
                canvas.drawLine(x2, y2, x1, y1, paint);
            }
            textPaint.setTextSize(dp(18));
            textPaint.setTextColor(Color.rgb(14, 77, 55));
            canvas.drawText("U", cx, cy - r + dp(28), textPaint);
            canvas.drawText("T", cx + r - dp(26), cy + dp(7), textPaint);
            canvas.drawText("S", cx, cy + r - dp(14), textPaint);
            canvas.drawText("B", cx - r + dp(26), cy + dp(7), textPaint);
            canvas.restore();

            if (ready) {
                canvas.save();
                canvas.rotate((float) relative, cx, cy);

                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeCap(Paint.Cap.ROUND);
                paint.setStrokeWidth(dp(7));
                paint.setColor(Color.rgb(181, 139, 39));
                canvas.drawLine(cx, cy + dp(18), cx, cy - r + dp(64), paint);

                arrow.reset();
                arrow.moveTo(cx, cy - r + dp(38));
                arrow.lineTo(cx - dp(14), cy - r + dp(70));
                arrow.lineTo(cx + dp(14), cy - r + dp(70));
                arrow.close();
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(Color.rgb(14, 77, 55));
                canvas.drawPath(arrow, paint);

                float kw = dp(38), kh = dp(34);
                float kx = cx - kw / 2f;
                float ky = cy - r + dp(2);
                paint.setColor(Color.BLACK);
                canvas.drawRoundRect(new RectF(kx, ky, kx + kw, ky + kh), dp(2), dp(2), paint);
                paint.setColor(Color.rgb(202, 166, 70));
                canvas.drawRect(kx, ky + dp(9), kx + kw, ky + dp(14), paint);
                paint.setColor(Color.rgb(181, 139, 39));
                canvas.drawRect(cx + dp(7), ky + dp(19), cx + dp(13), ky + kh, paint);
                canvas.restore();
            }

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.rgb(14, 77, 55));
            canvas.drawCircle(cx, cy, dp(9), paint);
            paint.setColor(Color.WHITE);
            canvas.drawCircle(cx, cy, dp(3), paint);
        }
    }
}
