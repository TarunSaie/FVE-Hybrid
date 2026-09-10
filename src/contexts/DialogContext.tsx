import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { FVEDialog, DialogButton, DialogType } from '@/components/common/FVEDialog';

export interface DialogOptions {
  title: string;
  message?: string;
  type?: DialogType;
  buttons?: DialogButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
}

interface DialogContextValue {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
  alert: (title: string, message?: string, onOk?: () => void) => void;
  confirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
  danger: (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void,
    cancelText?: string
  ) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Keep reference to original native Alert.alert as fallback
const originalNativeAlert = Alert.alert;

let globalShowDialog: ((options: DialogOptions) => void) | null = null;

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogOptions & { visible: boolean }>({
    visible: false,
    title: '',
  });

  const hideDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showDialog = useCallback(
    (options: DialogOptions) => {
      setDialogState({
        ...options,
        visible: true,
        onDismiss: () => {
          options.onDismiss?.();
          hideDialog();
        },
      });
    },
    [hideDialog]
  );

  const alert = useCallback(
    (title: string, message?: string, onOk?: () => void) => {
      showDialog({
        title,
        message,
        buttons: [
          {
            text: 'OK',
            style: 'default',
            onPress: () => {
              hideDialog();
              onOk?.();
            },
          },
        ],
      });
    },
    [showDialog, hideDialog]
  );

  const confirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
      confirmText = 'Confirm',
      cancelText = 'Cancel'
    ) => {
      showDialog({
        title,
        message,
        type: 'confirm',
        buttons: [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => {
              hideDialog();
              onCancel?.();
            },
          },
          {
            text: confirmText,
            style: 'default',
            onPress: () => {
              hideDialog();
              onConfirm();
            },
          },
        ],
      });
    },
    [showDialog, hideDialog]
  );

  const danger = useCallback(
    (
      title: string,
      message: string,
      confirmText: string,
      onConfirm: () => void,
      cancelText = 'Cancel'
    ) => {
      showDialog({
        title,
        message,
        type: 'danger',
        buttons: [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => {
              hideDialog();
            },
          },
          {
            text: confirmText,
            style: 'destructive',
            onPress: () => {
              hideDialog();
              onConfirm();
            },
          },
        ],
      });
    },
    [showDialog, hideDialog]
  );

  useEffect(() => {
    globalShowDialog = showDialog;

    // Intercept React Native's Alert.alert to route all calls to our custom React Native FVEDialog
    Alert.alert = (
      title: string,
      message?: string,
      buttons?: Array<{
        text?: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
      }>,
      options?: { cancelable?: boolean; onDismiss?: () => void }
    ) => {
      const formattedButtons: DialogButton[] =
        buttons && buttons.length > 0
          ? buttons.map((b) => ({
              text: b.text || 'OK',
              style: b.style || 'default',
              onPress: b.onPress,
            }))
          : [{ text: 'OK', style: 'default' }];

      showDialog({
        title: title || 'Notice',
        message: message || '',
        buttons: formattedButtons,
        cancelable: options?.cancelable ?? true,
        onDismiss: options?.onDismiss,
      });
    };

    return () => {
      globalShowDialog = null;
      Alert.alert = originalNativeAlert;
    };
  }, [showDialog]);

  return (
    <DialogContext.Provider
      value={{
        showDialog,
        hideDialog,
        alert,
        confirm,
        danger,
      }}
    >
      {children}
      <FVEDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        buttons={dialogState.buttons}
        cancelable={dialogState.cancelable}
        onDismiss={dialogState.onDismiss || hideDialog}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
