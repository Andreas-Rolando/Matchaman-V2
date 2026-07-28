import React, { useEffect, useState } from 'react';
import { X, Cpu, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';

interface EsbEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EsbEngineModal: React.FC<EsbEngineModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/esb/config');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#eae7e7] bg-[#34562e] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-[#c7f0bb]" />
            <div>
              <h3 className="font-serif text-base font-bold">
                ESB ESO-QS Engine Status
              </h3>
              <p className="text-[11px] text-[#c7f0bb]">
                Ordering System - Quick Service API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-[#1b1c1c]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-[#34562e]" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-[#c7f0bb]/30 p-3 text-[#012202]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#34562e]" />
                  <div>
                    <p className="font-bold">API Engine Connected</p>
                    <p className="text-[10px] opacity-80">
                      Endpoint: https://developers.esb.co.id/eso-qs/
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#34562e] px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                  {config?.mode || 'SANDBOX'}
                </span>
              </div>

              <div className="rounded-xl border border-[#eae7e7] bg-[#f6f3f2] p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#5d5f5b]">Merchant ID:</span>
                  <span className="font-bold">{config?.merchantId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5d5f5b]">API Specification:</span>
                  <span className="font-bold">{config?.engine}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5d5f5b]">Version:</span>
                  <span className="font-bold">{config?.apiVersion}</span>
                </div>
              </div>

              <div>
                <p className="font-bold text-[#34562e] mb-1">
                  Implemented Flow & Routes:
                </p>
                <ul className="space-y-1 font-mono text-[11px] bg-[#1b1c1c] text-[#c7f0bb] p-3 rounded-lg overflow-x-auto">
                  <li>GET /api/esb/outlets (Daftar Cabang)</li>
                  <li>GET /api/esb/outlets/:id (Detail Cabang)</li>
                  <li>GET /api/esb/menu (Kategori & Menu Items)</li>
                  <li>POST /api/esb/order (Create Order API)</li>
                  <li>GET /api/esb/order/:id/status (Cek Status)</li>
                </ul>
              </div>

              <div className="pt-2">
                <a
                  href={config?.docsUrl || 'https://developers.esb.co.id/eso-qs/'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#f0eded] px-4 py-2.5 font-semibold text-[#34562e] transition-colors hover:bg-[#eae7e7]"
                >
                  <span>Buka Dokumentasi ESB ESO-QS</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
