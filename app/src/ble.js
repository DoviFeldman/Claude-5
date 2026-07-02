// Optional BLE link to the ESP32 remote. The app is fully functional without
// it — connect() simply fails quietly and the on-screen controls do everything.
import { PermissionsAndroid, Platform } from 'react-native';

// UUIDs must match esp32/twitter_radio_remote/twitter_radio_remote.ino
export const SERVICE_UUID = '7a0b1000-b5a3-4a1c-9e0f-2b3c4d5e6f70';
export const CHARACTERISTIC_UUID = '7a0b1001-b5a3-4a1c-9e0f-2b3c4d5e6f70';

let BleManager = null;
try {
  // Loaded lazily so the app still runs on builds without the native module.
  BleManager = require('react-native-ble-plx').BleManager;
} catch {}

function decodeBase64(value) {
  if (typeof atob === 'function') return atob(value);
  return global.Buffer ? global.Buffer.from(value, 'base64').toString('utf8') : '';
}

export class Remote {
  constructor() {
    this.manager = BleManager ? new BleManager() : null;
    this.device = null;
    this.subscription = null;
  }

  get available() {
    return Boolean(this.manager);
  }

  async _requestPermissions() {
    if (Platform.OS !== 'android') return true;
    const wanted = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ].filter(Boolean);
    const results = await PermissionsAndroid.requestMultiple(wanted);
    return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }

  // Scans for the device by name, connects, and calls onSignal("SKIP"|...)
  // for every dial/button event. onState gets 'scanning'|'connected'|'disconnected'.
  async connect(deviceName, onSignal, onState) {
    if (!this.manager) throw new Error('BLE module not available in this build');
    if (!(await this._requestPermissions())) throw new Error('Bluetooth permission denied');
    await this.disconnect();
    onState?.('scanning');

    const device = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        reject(new Error(`No BLE device named "${deviceName}" found (15s)`));
      }, 15000);
      this.manager.startDeviceScan(null, null, (error, found) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          return reject(error);
        }
        if (found?.name === deviceName || found?.localName === deviceName) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          resolve(found);
        }
      });
    });

    this.device = await device.connect();
    await this.device.discoverAllServicesAndCharacteristics();
    this.subscription = this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          onState?.('disconnected');
          return;
        }
        const signal = decodeBase64(characteristic?.value || '').trim();
        if (signal) onSignal(signal);
      }
    );
    this.device.onDisconnected(() => onState?.('disconnected'));
    onState?.('connected');
  }

  async disconnect() {
    this.subscription?.remove();
    this.subscription = null;
    if (this.device) {
      await this.device.cancelConnection().catch(() => {});
      this.device = null;
    }
  }
}
