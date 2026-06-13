import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Instrument } from '@/api/trading';

interface TradingState {
  orderModalOpen: boolean;
  prefillInstrument: Instrument | null;
  prefillSide: 'BUY' | 'SELL';
  prefillClientId: string | null;
}

const initialState: TradingState = {
  orderModalOpen: false,
  prefillInstrument: null,
  prefillSide: 'BUY',
  prefillClientId: null,
};

const tradingSlice = createSlice({
  name: 'trading',
  initialState,
  reducers: {
    openOrderModal(
      state,
      action: PayloadAction<{ instrument?: Instrument; side?: 'BUY' | 'SELL'; clientId?: string }>
    ) {
      state.orderModalOpen = true;
      state.prefillInstrument = action.payload.instrument ?? null;
      state.prefillSide = action.payload.side ?? 'BUY';
      state.prefillClientId = action.payload.clientId ?? null;
    },
    closeOrderModal(state) {
      state.orderModalOpen = false;
      state.prefillInstrument = null;
      state.prefillSide = 'BUY';
      state.prefillClientId = null;
    },
  },
});

export const { openOrderModal, closeOrderModal } = tradingSlice.actions;
export default tradingSlice.reducer;
