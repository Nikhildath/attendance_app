package com.attendly.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

@CapacitorPlugin(name = "ScreenShare", requestCodes = { ScreenSharePlugin.REQUEST_CAPTURE })
public class ScreenSharePlugin extends Plugin {

  static final int REQUEST_CAPTURE = 9001;

  private MediaProjectionManager projectionManager;
  private MediaProjection mediaProjection;
  private VirtualDisplay virtualDisplay;
  private ImageReader imageReader;
  private Handler backgroundHandler;
  private boolean capturing = false;
  private int captureWidth = 720;
  private int captureHeight = 1280;

  @PluginMethod
  public void start(PluginCall call) {
    captureWidth = call.getInt("width", 720);
    captureHeight = call.getInt("height", 1280);

    projectionManager =
      (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
    Intent intent = projectionManager.createScreenCaptureIntent();
    startActivityForResult(call, intent, REQUEST_CAPTURE);
  }

  @Override
  protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
    super.handleOnActivityResult(requestCode, resultCode, data);

    if (requestCode != REQUEST_CAPTURE) return;

    PluginCall call = getSavedCall();
    if (call == null) return;

    if (resultCode != Activity.RESULT_OK) {
      call.reject("Screen capture permission denied");
      return;
    }

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
      call.reject("Screen capture requires Android 5+");
      return;
    }

    mediaProjection = projectionManager.getMediaProjection(resultCode, data);
    if (mediaProjection == null) {
      call.reject("Failed to create MediaProjection");
      return;
    }

    startCapture();
    call.resolve();
  }

  private void startCapture() {
    HandlerThread thread = new HandlerThread("ScreenCapture");
    thread.start();
    backgroundHandler = new Handler(thread.getLooper());

    imageReader =
      ImageReader.newInstance(captureWidth, captureHeight, PixelFormat.RGBA_8888, 2);

    int dpi = getContext().getResources().getDisplayMetrics().densityDpi;

    virtualDisplay =
      mediaProjection.createVirtualDisplay(
        "ScreenShare",
        captureWidth,
        captureHeight,
        dpi,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        imageReader.getSurface(),
        null,
        backgroundHandler
      );

    capturing = true;

    imageReader.setOnImageAvailableListener(reader -> {
      if (!capturing) return;
      Image image = reader.acquireLatestImage();
      if (image == null) return;

      Bitmap bitmap = imageToBitmap(image);
      image.close();

      if (bitmap != null) {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 60, bos);
        bitmap.recycle();

        String base64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);

        JSObject payload = new JSObject();
        payload.put("data", "data:image/jpeg;base64," + base64);
        payload.put("width", captureWidth);
        payload.put("height", captureHeight);
        notifyListeners("screenFrame", payload);
      }
    }, backgroundHandler);
  }

  private Bitmap imageToBitmap(Image image) {
    Image.Plane[] planes = image.getPlanes();
    ByteBuffer buffer = planes[0].getBuffer();
    int pixelStride = planes[0].getPixelStride();
    int rowStride = planes[0].getRowStride();
    int rowPadding = rowStride - pixelStride * captureWidth;

    Bitmap bitmap =
      Bitmap.createBitmap(
        captureWidth + rowPadding / pixelStride,
        captureHeight,
        Bitmap.Config.ARGB_8888
      );
    bitmap.copyPixelsFromBuffer(buffer);
    return Bitmap.createBitmap(bitmap, 0, 0, captureWidth, captureHeight);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    capturing = false;

    if (virtualDisplay != null) {
      virtualDisplay.release();
      virtualDisplay = null;
    }
    if (imageReader != null) {
      imageReader.close();
      imageReader = null;
    }
    if (mediaProjection != null) {
      mediaProjection.stop();
      mediaProjection = null;
    }
    if (backgroundHandler != null) {
      backgroundHandler.getLooper().quitSafely();
      backgroundHandler = null;
    }
    call.resolve();
  }
}
