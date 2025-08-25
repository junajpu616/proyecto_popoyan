import React, { useState } from 'react';
import { searchPlants } from '../api/plantApi';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onSearch = async (page = 1) => {
    setLoading(true); setErr('');
    try {
      const data = await searchPlants(q, page, 25);
      setResult(data);
    } catch (e) {
      setErr(e.message || 'Busqueda fallida');
    } finally {
      setLoading(false);
    }
  };

  const renderTaxonomy = (p) => {
    const t = p?.taxonomy || p?.classification || {};
    const parts = [
      t.kingdom,
      t.phylum || t.division,
      t.class || t.classis,
      t.order,
      t.family,
      t.genus,
      t.species,
    ].filter(Boolean);
    return parts.join(' • ');
  };

  const getImageUrl = (p) => {
    return (
      p?.image_url ||
      p?.image?.url ||
      p?.image?.small_url ||
      p?.thumbnail ||
      (Array.isArray(p?.images) ? p.images[0] : null) ||
      p?.picture?.url ||
      null
    );
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">Buscar plantas</h2>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="input-group">
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre común o científico"
              aria-label="Consulta de búsqueda"
            />
            <button
              className="btn btn-primary"
              onClick={() => onSearch(1)}
              disabled={loading || !q.trim()}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Buscando...
                </>
              ) : (
                'Buscar'
              )}
            </button>
          </div>

          {err && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {err}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="card shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Resultados</strong>
            <span className="badge text-bg-secondary">Total: {result.total}</span>
          </div>

          <div className="card-body p-0">
            <ul className="list-group list-group-flush">
              {result.plants.map((p, idx) => {
                const img = getImageUrl(p);
                const tax = renderTaxonomy(p);
                const name = p.entity_name || p.name || 'Sin nombre';
                const key = p.id ?? idx; // no usar token

                  // Número de resultado absoluto
                  const resultNumber = (Number(result.page) - 1) * Number(result.limit) + idx + 1;
                  return (
                      <li
                          key={key}
                          className="list-group-item"
                      >
                          <div className="d-flex align-items-center gap-3">
                              {/* Número de resultado relativo */}
                              <div
                                  className="d-flex align-items-center justify-content-center rounded-circle border text-muted"
                                  style={{width: 32, height: 32, minWidth: 32}}
                                  title={`Resultado #${resultNumber}`}
                                  aria-label={`Resultado número ${resultNumber}`}
                              >
                                  <span className="small">{resultNumber}</span>
                              </div>

                        {img ? (
                        <img
                          src={img}
                          alt={name}
                          className="img-thumbnail"
                          style={{ width: 64, height: 64, objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          className="bg-light border d-flex align-items-center justify-content-center rounded"
                          style={{ width: 64, height: 64 }}
                          aria-label="Sin imagen"
                          title="Sin imagen"
                        >
                          <span className="text-muted small">Sin foto</span>
                        </div>
                      )}
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{name}</div>
                        {tax && <div className="text-muted small">{tax}</div>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card-footer d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-outline-secondary"
                disabled={result.page <= 1}
                onClick={() => onSearch(result.page - 1)}
              >
                ← Anterior
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={result.page >= result.totalPages}
                onClick={() => onSearch(result.page + 1)}
              >
                Siguiente →
              </button>
            </div>
            <span className="text-muted">
              Página {result.page} / {result.totalPages}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}