import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { dataService } from '@/services/dataService';

type OfflineState = {
  isOnline: boolean;
  pendingCount: number;
  syncPendingChanges: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  initNetworkListener: () => () => void;
};

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  pendingCount: 0,
  async syncPendingChanges() {
    const result = await dataService.syncData();
    if (result.success) {
      set({ pendingCount: await dataService.getPendingChangesCount() });
    }
  },
  async refreshPendingCount() {
    set({ pendingCount: await dataService.getPendingChangesCount() });
  },
  initNetworkListener() {
    void dataService.getPendingChangesCount().then((count) => set({ pendingCount: count }));
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      set({ isOnline: connected });
      if (connected) {
        void dataService.syncData().then(() => {
          void dataService.getPendingChangesCount().then((count) => set({ pendingCount: count }));
        });
      }
    });
    return unsubscribe;
  },
}));
