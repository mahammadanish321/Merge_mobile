import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform, Image } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Camera, RefreshCcw, Flashlight, FlashlightOff, X, Video, Send, RotateCcw } from 'lucide-react-native';

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { id, name, year, stream } = params;
  
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'on'|'off'>('off');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'picture' | 'video'>('picture');
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission || !micPermission) {
    return <View />;
  }

  if (!permission.granted || !micPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.message}>We need camera and microphone permissions</Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={() => {
            requestPermission();
            requestMicPermission();
          }}
        >
          <Text style={styles.permissionText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  function toggleFlash() {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  }

  async function takePicture() {
    if (cameraRef.current && !isRecording && mode === 'picture') {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo) {
          setPreviewUri(photo.uri);
          setPreviewType('picture');
        }
      } catch (e) {
        console.error("Failed to take picture", e);
      }
    }
  }

  async function startRecording() {
    if (cameraRef.current && !isRecording && mode === 'video') {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync({ maxDuration: 90 });
        if (video) {
          setPreviewUri(video.uri);
          setPreviewType('video');
        }
      } catch (e) {
        console.error("Failed to record video", e);
      } finally {
        setIsRecording(false);
      }
    }
  }

  function stopRecording() {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  }

  function sendAttachment() {
    if (previewUri) {
      router.replace({
        pathname: '/chat/[id]',
        params: { 
          id: Array.isArray(id) ? id[0] : id, 
          name: Array.isArray(name) ? name[0] : name, 
          year: Array.isArray(year) ? year[0] : year, 
          stream: Array.isArray(stream) ? stream[0] : stream, 
          attachmentUri: previewUri 
        }
      });
    }
  }

  if (previewUri) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {/* Placeholder for video preview, just show dark screen with text since expo-video isn't installed */}
        {previewType === 'video' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Video Ready to Send</Text>
          </View>
        ) : (
          <View style={[styles.camera, { backgroundColor: '#000' }]} /> 
        )}
        
        {/* Proper Image preview */}
        {previewType === 'picture' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
             <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </View>
        )}

        <View style={styles.previewControls}>
          <TouchableOpacity style={styles.previewButton} onPress={() => setPreviewUri(null)}>
            <RotateCcw size={24} color="#fff" />
            <Text style={styles.previewText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.previewButton, { backgroundColor: '#22c55e' }]} onPress={sendAttachment}>
            <Send size={24} color="#fff" />
            <Text style={styles.previewText}>Send</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView 
        style={styles.camera} 
        facing={facing} 
        enableTorch={flash === 'on'}
        ref={cameraRef}
        mode={mode}
      >
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>
                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                {(recordingTime % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
            {flash === 'on' ? <Flashlight size={24} color="#fff" /> : <FlashlightOff size={24} color="#fff" />}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.modeButton} onPress={() => setMode(mode === 'picture' ? 'video' : 'picture')}>
            {mode === 'picture' ? <Video size={24} color="#fff" /> : <Camera size={24} color="#fff" />}
          </TouchableOpacity>
          
          {mode === 'picture' ? (
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.captureButton, isRecording && styles.recordingButton]} 
              onLongPress={startRecording}
              onPressOut={stopRecording}
              delayLongPress={200}
            >
              <View style={[styles.captureInner, isRecording && styles.recordingInner]} />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <RefreshCcw size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 20,
    color: '#fff',
    fontSize: 16,
  },
  permissionButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingTime: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  recordingInner: {
    backgroundColor: '#ff0000',
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewControls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
  },
  previewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    width: 50,
  }
});
