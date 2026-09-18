import { CameraView, useCameraPermissions } from 'expo-camera'
import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'

import { Icon } from '@/components/Icon'
import { Body, Button, Input, Muted, Sheet } from '@/components/ui'
import { COLORS } from '@/theme/tokens'

export function ScanField({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Scan or type a barcode',
  autoFocus = false,
  testID,
}: {
  value: string
  onChangeText: (value: string) => void
  onSubmit: (code: string) => void
  placeholder?: string
  autoFocus?: boolean
  testID?: string
}) {
  const [cameraOpen, setCameraOpen] = useState(false)

  return (
    <>
      <View className="flex-row gap-2">
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={() => value.trim() && onSubmit(value.trim())}
          className="flex-1"
          testID={testID}
        />
        {Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan with the camera"
            onPress={() => setCameraOpen(true)}
            testID={testID ? `${testID}-camera` : undefined}
            className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas"
          >
            <Icon name="Camera" size={20} color={COLORS.navy} />
          </Pressable>
        ) : null}
      </View>

      <CameraSheet
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScanned={(code) => {
          setCameraOpen(false)
          onChangeText(code)
          onSubmit(code)
        }}
      />
    </>
  )
}

export function CameraSheet({
  open,
  onClose,
  onScanned,
  title = 'Scan',
  subtitle = 'Point the camera at the barcode.',
}: {
  open: boolean
  onClose: () => void
  onScanned: (code: string) => void
  title?: string
  subtitle?: string
}) {
  const [permission, requestPermission] = useCameraPermissions()

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} testID="camera-sheet">
      {!permission ? (
        <Muted>Checking the camera…</Muted>
      ) : !permission.granted ? (
        <View className="gap-3">
          <Body>The camera has not been allowed for this app yet.</Body>
          <Button label="Allow the camera" onPress={() => void requestPermission()} testID="camera-permission" />
          <Muted>You can always type the barcode instead.</Muted>
        </View>
      ) : (
        <View className="h-72 overflow-hidden rounded-2xl bg-black">
          {open ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'qr'] }}
              onBarcodeScanned={({ data }) => data && onScanned(String(data))}
            />
          ) : null}
        </View>
      )}

      <Button label="Close" variant="secondary" onPress={onClose} testID="camera-close" />
    </Sheet>
  )
}
