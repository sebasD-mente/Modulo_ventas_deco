import React, { useState } from 'react';
import { ShoppingBag, Store, Smartphone, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_SIZES } from './manual-sale/manualSaleConstants';
import useCatalogSearch from './manual-sale/hooks/useCatalogSearch';
import useManualSaleCart from './manual-sale/hooks/useManualSaleCart';
import useRemoteSaleForm from './manual-sale/hooks/useRemoteSaleForm';
import CatalogSearchInput from './manual-sale/CatalogSearchInput';
import PosterConfigurator from './manual-sale/PosterConfigurator';
import SaleCartList from './manual-sale/SaleCartList';
import PaymentSummaryBar from './manual-sale/PaymentSummaryBar';
import CustomerWhatsAppSearch from './manual-sale/CustomerWhatsAppSearch';
import DeliveryMethodSelector from './manual-sale/DeliveryMethodSelector';
import RemoteQuoterSummary from './manual-sale/RemoteQuoterSummary';
import CustomItemModal from './manual-sale/CustomItemModal';
import WhatsAppQuoteShareModal from './manual-sale/WhatsAppQuoteShareModal';

export default function FastManualSaleForm({ eventId, onSaleRegistered, initialDraft = null }) {
  const { isVendedorRedes, isVendedor, isSuperAdmin } = useAuth();
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isVendedor && !isSuperAdmin);
  const [saleMode, setSaleMode] = useState(
    isVendedorRedesOnly ? 'REDES_PERSONALIZADO' : 'POS_FERIA'
  );
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const search = useCatalogSearch();
  const cart = useManualSaleCart({ eventId, onSaleRegistered, initialDraft });
  const remoteForm = useRemoteSaleForm({ eventId, onSaleRegistered, cart });

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
      {/* Cabecera y Toggle de Modo de Venta */}
      <div className="space-y-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              {isVendedorRedesOnly ? (
                <>
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>📱 Gestión de Pedidos de Redes</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-white" />
                  <span>Terminal de Ventas</span>
                </>
              )}
            </h3>
            <p className="text-xs text-neutral-400">
              {isVendedorRedesOnly
                ? 'Catálogo general, diseños personalizados, CRM WhatsApp y logística de envíos'
                : saleMode === 'POS_FERIA'
                  ? 'Venta rápida y cobro presencial en mostrador'
                  : 'Venta remota con anticipo 50/50, CRM y logística'}
            </p>
          </div>
        </div>

        {/* Toggle Segmented Control (Ergonomía >= 44px) */}
        {!isVendedorRedesOnly && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-2xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setSaleMode('POS_FERIA')}
              className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                saleMode === 'POS_FERIA'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>Mostrador (Feria 100%)</span>
            </button>
            <button
              type="button"
              onClick={() => setSaleMode('REDES_PERSONALIZADO')}
              className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                saleMode === 'REDES_PERSONALIZADO'
                  ? 'bg-amber-400 text-black shadow-md font-black'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Redes / 50-50 (WhatsApp)</span>
            </button>
          </div>
        )}
      </div>

      {cart.errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold">
          ⚠️ {cart.errorMsg}
        </div>
      )}

      {/* MODO REDES / PERSONALIZADO */}
      {saleMode === 'REDES_PERSONALIZADO' ? (
        <div className="space-y-5">
          {/* CRM y Cliente */}
          <CustomerWhatsAppSearch
            customerQuery={remoteForm.customerQuery} setCustomerQuery={remoteForm.setCustomerQuery}
            customerResults={remoteForm.customerResults} isSearchingCustomer={remoteForm.isSearchingCustomer}
            selectedCustomer={remoteForm.selectedCustomer} customerData={remoteForm.customerData}
            setCustomerData={remoteForm.setCustomerData} isInlineCreation={remoteForm.isInlineCreation}
            setIsInlineCreation={remoteForm.setIsInlineCreation} selectCustomer={remoteForm.selectCustomer}
            clearSelectedCustomer={remoteForm.clearSelectedCustomer} departments={remoteForm.departments}
          />

          {/* Búsqueda Catálogo + Botón Personalizado */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Catálogo Físico o Pedido Personalizado
              </label>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(true)}
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Palette className="w-4 h-4" />
                <span>+ Personalizado</span>
              </button>
            </div>

            <CatalogSearchInput
              {...search}
              onSelectPoster={handleSelectPoster}
              onClearSearch={search.clearSearch}
              hasSelectedPoster={Boolean(selectedPoster)}
            />
          </div>

          {selectedPoster && (
            <PosterConfigurator
              selectedPoster={selectedPoster}
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
              itemQuantity={itemQuantity}
              setItemQuantity={setItemQuantity}
              onAddToCart={handleAddToCart}
              onCancel={() => { setSelectedPoster(null); search.clearSearch(); }}
            />
          )}

          {/* Selector de Entrega y Logística */}
          <DeliveryMethodSelector
            deliveryMethod={remoteForm.deliveryMethod}
            setDeliveryMethod={remoteForm.setDeliveryMethod}
            shippingCost={remoteForm.shippingCost}
            setShippingCost={remoteForm.setShippingCost}
            shippingCourier={remoteForm.shippingCourier}
            setShippingCourier={remoteForm.setShippingCourier}
            shippingTrackingNumber={remoteForm.shippingTrackingNumber}
            setShippingTrackingNumber={remoteForm.setShippingTrackingNumber}
            pickupEventId={remoteForm.pickupEventId}
            setPickupEventId={remoteForm.setPickupEventId}
            availablePickupEvents={remoteForm.availablePickupEvents}
          />

          {/* Lista de Pósters en la Orden */}
          <SaleCartList
            cartItems={cart.cartItems} attachments={cart.attachments} inputChannel={cart.inputChannel}
            onUnlinkAttachments={cart.unlinkAttachments} onUpdateQty={cart.updateItemQty}
            onChangeSize={cart.changeItemSize} onRemoveItem={cart.removeItem} onClearCart={cart.clearCart}
          />

          {/* Cotizador 50/50 y Registro de Anticipo */}
          <RemoteQuoterSummary
            productsSubtotal={remoteForm.productsSubtotal}
            productsAmount={remoteForm.productsAmount}
            discount={cart.discount}
            effectiveShippingCost={remoteForm.effectiveShippingCost}
            totalAmount={remoteForm.totalAmount}
            minDeposit={remoteForm.minDeposit}
            depositInput={remoteForm.depositInput}
            setDepositInput={remoteForm.setDepositInput}
            numericDeposit={remoteForm.numericDeposit}
            balanceDue={remoteForm.balanceDue}
            isDepositValid={remoteForm.isDepositValid}
            depositPaymentMethod={remoteForm.depositPaymentMethod}
            setDepositPaymentMethod={remoteForm.setDepositPaymentMethod}
            depositReference={remoteForm.depositReference}
            setDepositReference={remoteForm.setDepositReference}
            remoteSaleNotes={remoteForm.remoteSaleNotes}
            setRemoteSaleNotes={remoteForm.setRemoteSaleNotes}
            depositReceiptUrl={remoteForm.depositReceiptUrl}
            setDepositReceiptUrl={remoteForm.setDepositReceiptUrl}
            isUploadingReceipt={remoteForm.isUploadingReceipt}
            receiptUploadError={remoteForm.receiptUploadError}
            onUploadReceipt={remoteForm.handleReceiptUpload}
            isPendingPaymentOnly={remoteForm.isPendingPaymentOnly}
            setIsPendingPaymentOnly={remoteForm.setIsPendingPaymentOnly}
            isSubmitting={remoteForm.isSubmitting}
            submitError={remoteForm.submitError}
            onConfirmRemoteSale={remoteForm.confirmRemoteSale}
          />

          {/* Modal de Ítem Personalizado */}
          <CustomItemModal
            isOpen={isCustomModalOpen}
            onClose={() => setIsCustomModalOpen(false)}
            onAddCustomItem={remoteForm.addCustomItem}
          />

          {/* Modal Compartir Comprobante por WhatsApp */}
          <WhatsAppQuoteShareModal
            isOpen={remoteForm.showShareModal}
            onClose={() => remoteForm.setShowShareModal(false)}
            sale={remoteForm.completedSale}
          />
        </div>
      ) : (
        /* MODO MOSTRADOR (FERIA 100%) - INTRACTO */
        <div className="space-y-6">
          <CatalogSearchInput
            {...search}
            onSelectPoster={handleSelectPoster}
            onClearSearch={search.clearSearch}
            hasSelectedPoster={Boolean(selectedPoster)}
          />

          {selectedPoster && (
            <PosterConfigurator
              selectedPoster={selectedPoster}
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
              itemQuantity={itemQuantity}
              setItemQuantity={setItemQuantity}
              onAddToCart={handleAddToCart}
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
            discount={cart.discount} setDiscount={cart.setDiscount}
            notes={cart.notes} setNotes={cart.setNotes}
            grandTotal={cart.grandTotal} isSubmitting={cart.isSubmitting}
            disabled={cart.cartItems.length === 0} onConfirmSale={cart.confirmSale}
          />
        </div>
      )}
    </div>
  );
}
