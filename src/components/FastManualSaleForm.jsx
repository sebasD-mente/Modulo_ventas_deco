import React, { useState } from 'react';
import { ShoppingBag, Store, Smartphone, Palette, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_SIZES, DEFAULT_MEDIUM_SIZE } from './manual-sale/manualSaleConstants';
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
  const { isVendedorRedes, isVendedor, isSuperAdmin, authFetch } = useAuth();
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isVendedor && !isSuperAdmin);
  const isVendedorMostradorOnly = Boolean(isVendedor && !isVendedorRedes && !isSuperAdmin);
  const canToggleSaleMode = Boolean(isSuperAdmin || (isVendedor && isVendedorRedes));
  const [saleMode, setSaleMode] = useState(
    isVendedorRedesOnly ? 'REDES_PERSONALIZADO' : 'POS_FERIA'
  );
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [syncFeedbackMsg, setSyncFeedbackMsg] = useState(null);

  const handleSyncCatalog = async () => {
    if (isSyncingCatalog) return;
    setIsSyncingCatalog(true);
    setSyncFeedbackMsg(null);
    try {
      const res = await authFetch('/api/catalog/sync', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        const count = json.count ?? json.data?.count ?? 0;
        setSyncFeedbackMsg({ text: `Catálogo actualizado (${count} obra${count === 1 ? '' : 's'} nueva${count === 1 ? '' : 's'})`, isError: false });
      } else {
        const errJson = await res.json().catch(() => ({}));
        setSyncFeedbackMsg({ text: errJson.error || 'No se pudo sincronizar el catálogo', isError: true });
      }
    } catch (err) {
      console.warn('[FastManualSaleForm] Error sincronizando catálogo web:', err);
      setSyncFeedbackMsg({ text: 'No se pudo conectar con la tienda web', isError: true });
    } finally {
      setIsSyncingCatalog(false);
      setTimeout(() => setSyncFeedbackMsg(null), 5000);
    }
  };

  const renderSyncControl = (label = 'Sincronizar catálogo') => (
    <button
      type="button"
      onClick={handleSyncCatalog}
      disabled={isSyncingCatalog}
      title="Sincronizar catálogo web"
      aria-label="Sincronizar catálogo web"
      className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-4 h-4 text-cyan-400 shrink-0 ${isSyncingCatalog ? 'animate-spin' : ''}`} />
      <span className="text-xs">{label}</span>
    </button>
  );

  const renderSyncFeedback = () => syncFeedbackMsg ? (
    <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
      syncFeedbackMsg.isError ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
    }`}>
      <span>{syncFeedbackMsg.text}</span>
    </div>
  ) : null;

  const search = useCatalogSearch(eventId);
  const cart = useManualSaleCart({ eventId, onSaleRegistered, initialDraft });
  const remoteForm = useRemoteSaleForm({ eventId, onSaleRegistered, cart });

  const [selectedPoster, setSelectedPoster] = useState(null);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_MEDIUM_SIZE);
  const [itemQuantity, setItemQuantity] = useState(1);

  const handleSelectPoster = (poster) => {
    setSelectedPoster(poster);
    setSelectedSize(poster.sizes?.find((s) => s.sizeId === 'MEDIANO') || poster.sizes?.[0] || DEFAULT_MEDIUM_SIZE);
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
        {canToggleSaleMode && (
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

      {/* MODO REDES / PERSONALIZADO (Exclusivo para SUPER_ADMIN y VENDEDOR_REDES) */}
      {saleMode === 'REDES_PERSONALIZADO' && (isSuperAdmin || isVendedorRedes) ? (
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
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Catálogo Físico o Personalizado
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
              eventId={eventId}
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

          {/* Lista de Pósters en la Orden */}
          <SaleCartList
            cartItems={cart.cartItems} attachments={cart.attachments} inputChannel={cart.inputChannel}
            onUnlinkAttachments={cart.unlinkAttachments} onUpdateQty={cart.updateItemQty}
            onChangeSize={cart.changeItemSize} onRemoveItem={cart.removeItem} onClearCart={cart.clearCart}
          />

          {/* Selector de Entrega y Logística */}
          <DeliveryMethodSelector
            deliveryMethod={remoteForm.deliveryMethod} setDeliveryMethod={remoteForm.setDeliveryMethod}
            shippingCost={remoteForm.shippingCost} setShippingCost={remoteForm.setShippingCost}
            shippingCourier={remoteForm.shippingCourier} setShippingCourier={remoteForm.setShippingCourier}
            shippingTrackingNumber={remoteForm.shippingTrackingNumber} setShippingTrackingNumber={remoteForm.setShippingTrackingNumber}
            pickupEventId={remoteForm.pickupEventId} setPickupEventId={remoteForm.setPickupEventId}
            availablePickupEvents={remoteForm.availablePickupEvents}
          />

          {/* Cotizador 50/50 y Registro de Anticipo */}
          <RemoteQuoterSummary
            productsSubtotal={remoteForm.productsSubtotal} productsAmount={remoteForm.productsAmount}
            discount={cart.discount} effectiveShippingCost={remoteForm.effectiveShippingCost}
            totalAmount={remoteForm.totalAmount} minDeposit={remoteForm.minDeposit}
            depositInput={remoteForm.depositInput} setDepositInput={remoteForm.setDepositInput}
            numericDeposit={remoteForm.numericDeposit} balanceDue={remoteForm.balanceDue}
            isDepositValid={remoteForm.isDepositValid} depositPaymentMethod={remoteForm.depositPaymentMethod}
            setDepositPaymentMethod={remoteForm.setDepositPaymentMethod} depositReference={remoteForm.depositReference}
            setDepositReference={remoteForm.setDepositReference} remoteSaleNotes={remoteForm.remoteSaleNotes}
            setRemoteSaleNotes={remoteForm.setRemoteSaleNotes} depositReceiptUrl={remoteForm.depositReceiptUrl}
            setDepositReceiptUrl={remoteForm.setDepositReceiptUrl} isUploadingReceipt={remoteForm.isUploadingReceipt}
            receiptUploadError={remoteForm.receiptUploadError} onUploadReceipt={remoteForm.handleReceiptUpload}
            isPendingPaymentOnly={remoteForm.isPendingPaymentOnly} setIsPendingPaymentOnly={remoteForm.setIsPendingPaymentOnly}
            isSubmitting={remoteForm.isSubmitting} submitError={remoteForm.submitError}
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
        /* MODO MOSTRADOR (FERIA 100%) */
        <div className="space-y-6">
          {/* Banner de Borrador Importado de IA */}
          {cart.inputChannel !== 'MANUAL_RAPIDA' && cart.cartItems.length > 0 && (
            <div className="p-3.5 bg-cyan-950/60 border border-cyan-800 rounded-2xl flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 text-cyan-300">
                <span className="text-base">⚡</span>
                <span>
                  Borrador importado desde IA ({cart.cartItems.length} obra{cart.cartItems.length > 1 ? 's' : ''}). Puedes ajustar o cobrar.
                </span>
              </div>
              <button
                type="button"
                onClick={cart.clearCart}
                className="min-h-[36px] px-3 py-1 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                Descartar
              </button>
            </div>
          )}


          <div className="space-y-2">
            <div className="flex items-center justify-end gap-2">
              {renderSyncControl('Sincronizar catálogo')}
            </div>
            {renderSyncFeedback()}
            <CatalogSearchInput
              {...search}
              eventId={eventId}
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

          <SaleCartList
            cartItems={cart.cartItems} attachments={cart.attachments} inputChannel={cart.inputChannel}
            onUnlinkAttachments={cart.unlinkAttachments} onUpdateQty={cart.updateItemQty}
            onChangeSize={cart.changeItemSize} onRemoveItem={cart.removeItem} onClearCart={cart.clearCart}
          />

          <PaymentSummaryBar
            paymentMethod={cart.paymentMethod}
            setPaymentMethod={cart.setPaymentMethod}
            discount={cart.effectiveDiscount || cart.discount}
            setDiscount={cart.setDiscount}
            notes={cart.notes}
            setNotes={cart.setNotes}
            subtotal={cart.subtotal}
            grandTotal={cart.grandTotal}
            hasActiveCombo={cart.hasActiveCombo}
            comboSavings={cart.comboSavings}
            comboTrios={cart.comboTrios}
            mediumCount={cart.mediumCount}
            isSubmitting={cart.isSubmitting}
            disabled={cart.cartItems.length === 0}
            onConfirmSale={cart.confirmSale}
          />
        </div>
      )}
    </div>
  );
}
