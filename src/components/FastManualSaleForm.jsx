import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { DEFAULT_SIZES } from './manual-sale/manualSaleConstants';
import useCatalogSearch from './manual-sale/hooks/useCatalogSearch';
import useManualSaleCart from './manual-sale/hooks/useManualSaleCart';
import CatalogSearchInput from './manual-sale/CatalogSearchInput';
import PosterConfigurator from './manual-sale/PosterConfigurator';
import SaleCartList from './manual-sale/SaleCartList';
import PaymentSummaryBar from './manual-sale/PaymentSummaryBar';

export default function FastManualSaleForm({ eventId, onSaleRegistered, initialDraft = null }) {
  const search = useCatalogSearch();
  const cart = useManualSaleCart({ eventId, onSaleRegistered, initialDraft });
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZES[2]);
  const [itemQuantity, setItemQuantity] = useState(1);

  const handleSelectPoster = (poster) => {
    setSelectedPoster(poster);
    setSelectedSize(poster.sizes?.find((s) => s.sizeId === 'MEDIANO') || poster.sizes?.[0] || DEFAULT_SIZES[2]);
    setItemQuantity(1);
    search.selectPoster(poster);
  };

  const handleAddToCart = () => {
    cart.addItemFromPoster(selectedPoster, selectedSize, itemQuantity);
    setSelectedPoster(null);
    search.clearSearch();
  };

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-6 text-white max-w-2xl mx-auto">
      <div className="pb-3 border-b border-neutral-800">
        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-white" /> Venta manual</h3>
        <p className="text-xs text-neutral-400">Registro rápido y cobro de pósters</p>
      </div>

      {cart.errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold">⚠️ {cart.errorMsg}</div>
      )}

      <CatalogSearchInput {...search} onSelectPoster={handleSelectPoster} onClearSearch={search.clearSearch} hasSelectedPoster={Boolean(selectedPoster)} />

      {selectedPoster && (
        <PosterConfigurator
          selectedPoster={selectedPoster} selectedSize={selectedSize} setSelectedSize={setSelectedSize}
          itemQuantity={itemQuantity} setItemQuantity={setItemQuantity} onAddToCart={handleAddToCart}
          onCancel={() => { setSelectedPoster(null); search.clearSearch(); }}
        />
      )}

      <SaleCartList
        cartItems={cart.cartItems} attachments={cart.attachments} inputChannel={cart.inputChannel}
        onUnlinkAttachments={cart.unlinkAttachments} onUpdateQty={cart.updateItemQty}
        onChangeSize={cart.changeItemSize} onRemoveItem={cart.removeItem} onClearCart={cart.clearCart}
      />

      <PaymentSummaryBar
        paymentMethod={cart.paymentMethod} setPaymentMethod={cart.setPaymentMethod}
        discount={cart.discount} setDiscount={cart.setDiscount} notes={cart.notes} setNotes={cart.setNotes}
        grandTotal={cart.grandTotal} isSubmitting={cart.isSubmitting}
        disabled={cart.cartItems.length === 0} onConfirmSale={cart.confirmSale}
      />
    </div>
  );
}
