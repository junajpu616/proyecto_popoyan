import React, { useEffect, useState } from 'react';
import { getUsageInfo } from '../api/plantApi';

export default function StadisticsPage() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const data = await getUsageInfo();
      setInfo(data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pct = (used, total) => {
    if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return null;
    return Math.min(100, Math.max(0, (used / total) * 100));
  };

  const renderProgress = (label, used, total, remaining) => {
    const percent = pct(used, total);
    return (
      <div className="mb-3">
        <div className="d-flex justify-content-between">
          <span className="fw-semibold">{label}</span>
          <span className="text-muted small">
            Usados: {used ?? '—'} · Restantes: {remaining ?? '—'} {Number.isFinite(total) ? `· Total: ${total}` : ''}
          </span>
        </div>
        {Number.isFinite(total) ? (
          <>
            <div className="progress" role="progressbar" aria-valuenow={percent ?? 0} aria-valuemin="0" aria-valuemax="100">
              <div
                className={`progress-bar ${percent >= 80 ? 'bg-danger' : percent >= 60 ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${percent ?? 0}%` }}
              >
                {percent !== null ? `${percent.toFixed(1)}%` : ''}
              </div>
            </div>
            <div className="form-text">Porcentaje usado sobre el total.</div>
          </>
        ) : (
          <div className="alert alert-secondary py-2 my-2 mb-0">
            No hay límite configurado para {label.toLowerCase()} (ilimitado o no definido).
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0">Estadísticas del API Key</h2>
        <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Actualizando...
            </>
          ) : 'Actualizar'}
        </button>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {!info ? (
        <div className="d-flex align-items-center">
          <span className="spinner-border spinner-border-sm me-2"></span>
          Cargando...
        </div>
      ) : (
        <div className="row g-4">
          {/* Estado general */}
          <div className="col-12 col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-header">
                <strong>Estado</strong>
              </div>
              <div className="card-body">
                <div className="mb-2">
                  <span className={`badge ${info.active ? 'text-bg-success' : 'text-bg-danger'}`}>
                    {info.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="mb-2">
                  {info.can_use ? (
                    <span className="badge text-bg-primary">Créditos habilitados</span>
                  ) : (
                    <span className="badge text-bg-secondary">Créditos no disponibles</span>
                  )}
                </div>
                {info.reason && (
                  <div className="alert alert-warning py-2 mb-0">
                    Motivo: {info.reason}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Límites declarados */}
          <div className="col-12 col-lg-8">
            <div className="card shadow-sm h-100">
              <div className="card-header">
                <strong>Límites de créditos</strong>
              </div>
              <div className="card-body">
                <div className="row row-cols-1 row-cols-md-2 g-3">
                  <div className="col">
                    <div className="border rounded p-2 h-100">
                      <div className="text-muted small">Día</div>
                      <div className="fs-5">{info.credit_limits?.day ?? '—'}</div>
                    </div>
                  </div>
                  <div className="col">
                    <div className="border rounded p-2 h-100">
                      <div className="text-muted small">Semana</div>
                      <div className="fs-5">{info.credit_limits?.week ?? '—'}</div>
                    </div>
                  </div>
                  <div className="col">
                    <div className="border rounded p-2 h-100">
                      <div className="text-muted small">Mes</div>
                      <div className="fs-5">{info.credit_limits?.month ?? '—'}</div>
                    </div>
                  </div>
                  <div className="col">
                    <div className="border rounded p-2 h-100">
                      <div className="text-muted small">Total</div>
                      <div className="fs-5">{info.credit_limits?.total ?? '—'}</div>
                    </div>
                  </div>
                </div>
                <div className="form-text mt-2">Un valor “—” significa que no hay límite configurado.</div>
              </div>
            </div>
          </div>

          {/* Uso y restantes con barras de progreso (por total y mes; si hay límites de día/semana se muestran también) */}
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header">
                <strong>Consumo de créditos</strong>
              </div>
              <div className="card-body">
                {renderProgress(
                  'Total',
                  info.used?.total ?? null,
                  info.credit_limits?.total ?? null,
                  info.remaining?.total ?? null
                )}

                {Number.isFinite(info.credit_limits?.month) || Number.isFinite(info.used?.month) ? renderProgress(
                  'Mes',
                  info.used?.month ?? null,
                  info.credit_limits?.month ?? null,
                  info.remaining?.month ?? null
                ) : null}

                {Number.isFinite(info.credit_limits?.week) || Number.isFinite(info.used?.week) ? renderProgress(
                  'Semana',
                  info.used?.week ?? null,
                  info.credit_limits?.week ?? null,
                  info.remaining?.week ?? null
                ) : null}

                {Number.isFinite(info.credit_limits?.day) || Number.isFinite(info.used?.day) ? renderProgress(
                  'Día',
                  info.used?.day ?? null,
                  info.credit_limits?.day ?? null,
                  info.remaining?.day ?? null
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}