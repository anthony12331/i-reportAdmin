package com.example.incidentreports;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.Window;
import android.widget.Button;

import androidx.annotation.NonNull;

public class SuccessDialog extends Dialog {

    private final OnOkClickListener listener;

    public interface OnOkClickListener {
        void onOkClick();
    }

    public SuccessDialog(@NonNull Context context, OnOkClickListener listener) {
        super(context);
        this.listener = listener;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_success);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }

        setCancelable(false);

        Button btnOk = findViewById(R.id.btnSuccessOk);
        btnOk.setOnClickListener(v -> {
            dismiss();
            if (listener != null) {
                listener.onOkClick();
            }
        });
    }
}
