import React, { useEffect, useState } from 'react';
import { getFamilies } from '../api/plantApi';

export default function FamiliesPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');

  const load = async (p = 1) => {
    setErr('');
    try {
      const res = await getFamilies(p, 25);
      setData(res);
      setPage(p);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Error al cargar familias');
    }
  };

  useEffect(() => { load(1); }, []);

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0">Familias</h2>
        {data && <span className="badge text-bg-secondary">Total: {data.total}</span>}
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {!data ? (
        <div className="d-flex align-items-center">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Cargando...
        </div>
      ) : data.families.length === 0 ? (
        <div className="alert alert-warning">No hay familias para mostrar</div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 g-3">
          {data.families.map((f) => (
            <div className="col" key={f.family}>
              <div className="card h-100 shadow-sm">
                {f.sample_image ? (
                  <img
                    src={f.sample_image}
                    alt={f.family}
                    className="card-img-top"
                    style={{ height: 160, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="bg-light border d-flex align-items-center justify-content-center"
                    style={{ height: 160 }}
                    title="Sin imagen"
                  >
                    <span className="text-muted">Sin imagen</span>
                  </div>
                )}
                <div className="card-body">
                  <h5 className="card-title mb-1">{f.family}</h5>
                  <p className="card-text text-muted mb-0">
                    Plantas registradas: <strong>{f.plant_count}</strong>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="btn-group">
            <button
              className="btn btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => load(page - 1)}
            >
              ← Anterior
            </button>
            <button
              className="btn btn-outline-secondary"
              disabled={page >= data.totalPages}
              onClick={() => load(page + 1)}
            >
              Siguiente →
            </button>
          </div>
          <div className="text-muted">
            Página {data.page} / {data.totalPages}
          </div>
        </div>
      )}
    </div>
  );
}