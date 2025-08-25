import React, { useState, useRef } from 'react';
import { identifyPlantByImageFile } from '../api/plantApi';

export default function IdentifyPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const pct = (v) =>
    typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : null;

  const onPick = (e) => {
    setErr('');
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErr('Selecciona una imagen válida');
      setFile(null);
      setPreview('');
      return;
    }
    if (f.size > 8 * 1024 * 1024) { // 8MB
      setErr('La imagen no debe superar 8MB');
      setFile(null);
      setPreview('');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (loading) return;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const evt = { target: { files: [f] } };
    onPick(evt);
  };

  const onIdentify = async () => {
    if (!file) return;
    setLoading(true);
    setErr('');
    setResult(null);
    try {
      const data = await identifyPlantByImageFile(file);
      setResult(data);

      const token =
        data?.identification?.access_token ||
        data?.access_token ||
        null;
      if (token) {
        try {
          sessionStorage.setItem('chatbot_access_token', token);
        } catch {}
      }
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Fallo al identificar');
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setFile(null);
    setPreview('');
    setResult(null);
    setErr('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const renderResult = () => {
    if (!result) return null;

    const ident = result.identification || result;
    const input = ident?.input || {};
    const meta = {
      access_token: ident?.access_token,
      model_version: ident?.model_version,
      status: ident?.status,
      created: ident?.created,
      completed: ident?.completed
    };
    const isPlant = ident?.result?.is_plant;
    const suggestions =
      ident?.result?.classification?.suggestions ||
      result?.suggestions ||
      [];

    const pct = (v) =>
      typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : null;

    return (
      <>
        {/* Meta y entrada */}
        <div className="mb-3">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {typeof isPlant?.probability === 'number' && (
              <span className={`badge ${isPlant.probability >= isPlant.threshold ? 'text-bg-success' : 'text-bg-secondary'}`}>
                Es planta: {pct(isPlant.probability)}
              </span>
            )}
          </div>

          {/* Imagen de entrada */}
          {Array.isArray(input.images) && input.images.length > 0 && (
            <div className="mt-3 d-flex align-items-center gap-3">
              <div>
                <div className="text-muted small">Imagen analizada</div>
                <img
                  src={input.images[0]}
                  alt="input"
                  className="rounded border"
                  style={{ width: 160, height: 160, objectFit: 'cover' }}
                />
              </div>
              <div className="text-muted small">
                {input.datetime && <div>Fecha: {new Date(input.datetime).toLocaleString()}</div>}
                {typeof input.latitude === 'number' && typeof input.longitude === 'number' && (
                  <div>Ubicación: {input.latitude}, {input.longitude}</div>
                )}
                <div>Similar images: {input.similar_images ? 'sí' : 'no'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Sugerencias */}
        {Array.isArray(suggestions) && suggestions.length > 0 ? (
          <div>
            <h5 className="mb-3">Sugerencias</h5>
            <div className="row row-cols-1 row-cols-md-2 g-3">
              {suggestions.map((sug, idx) => {
                const name = sug.name || sug.scientific_name || 'Desconocido';
                const prob = pct(sug.probability);
                const sims = Array.isArray(sug.similar_images) ? sug.similar_images : [];

                return (
                  <div className="col" key={sug.id || idx}>
                    <div className="card h-100">
                      {sims[0]?.url_small || sims[0]?.url ? (
                        <img
                          src={sims[0].url_small || sims[0].url}
                          alt={name}
                          className="card-img-top"
                          style={{ height: 160, objectFit: 'cover' }}
                        />
                      ) : null}
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                          <h6 className="card-title mb-1">{name}</h6>
                          {prob && <span className="badge text-bg-primary">{prob}</span>}
                        </div>

                        {sims.length > 1 && (
                          <div className="mt-2 d-flex flex-wrap gap-2">
                            {sims.slice(0, 6).map((img, i) => (
                              <img
                                key={img.id || i}
                                src={img.url_small || img.url}
                                alt={`sim-${i}`}
                                className="rounded border"
                                style={{ width: 56, height: 56, objectFit: 'cover' }}
                                title={img.citation || ''}
                              />
                            ))}
                            {sims.length > 6 && (
                              <span className="badge text-bg-light align-self-center">+{sims.length - 6} más</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="alert alert-warning">No se recibieron sugerencias para esta imagen.</div>
        )}

        {/* Depuración opcional */}
        <details className="mt-3">
          <summary className="text-muted">Ver JSON completo</summary>
          <pre className="bg-light p-3 border rounded small mt-2" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </>
    );
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">Identificar planta por imagen</h2>
      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border rounded d-flex flex-column align-items-center justify-content-center p-4 text-center"
                style={{ minHeight: 180, background: '#fafafa' }}
              >
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="preview"
                      className="rounded border mb-3"
                      style={{ width: 220, height: 220, objectFit: 'cover' }}
                    />
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={loading}
                      >
                        Cambiar imagen
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={clearImage}
                        disabled={loading}
                      >
                        Quitar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-muted mb-2">Arrastra y suelta una imagen aquí</div>
                    <div className="text-muted small mb-3">o</div>
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => inputRef.current?.click()}
                      disabled={loading}
                    >
                      Seleccionar imagen
                    </button>
                    <div className="form-text mt-3">
                      Formatos permitidos: JPG/PNG · Máx 8MB
                    </div>
                  </>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  className="d-none"
                  accept="image/*"
                  onChange={onPick}
                />
              </div>

              <div className="d-grid mt-3">
                <button
                  className="btn btn-success"
                  onClick={onIdentify}
                  disabled={!file || loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Identificando...
                    </>
                  ) : (
                    'Identificar'
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
        </div>

        <div className="col-12 col-lg-7">
          <div className="card shadow-sm">
            <div className="card-header">
              <strong>Resultado</strong>
            </div>
            <div className="card-body">
              {!result && !err && (
                <div className="text-muted">Sube una imagen y presiona Identificar.</div>
              )}
              {renderResult()}
              {err && (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {err}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}