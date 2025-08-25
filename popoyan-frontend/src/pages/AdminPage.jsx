import React, { useEffect, useState } from 'react';
import { listPlants, createPlant, updatePlant, changePlantStatus } from '../api/plantApi';

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  // Estado para edición
  const [selectedId, setSelectedId] = useState(null);
  const [original, setOriginal] = useState(null); // planta original para hacer diff

  const [form, setForm] = useState({
    entity_name: '',
    scientific_name: '',
    common_names: '', // coma-separado
    images: '',       // coma-separado
    // campos de taxonomía por separado
    taxonomy_kingdom: '',
    taxonomy_phylum: '',
    taxonomy_class: '',
    taxonomy_order: '',
    taxonomy_family: '',
    taxonomy_genus: '',
    taxonomy_species: '',
    description: '',
    access_token: ''
  });

  const [msg, setMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const load = async (p = 1, status = statusFilter) => {
    const res = await listPlants(p, 10, status); // 10 por página
    setData(res);
    setPage(p);
  };

  useEffect(() => { load(1, statusFilter); }, [statusFilter]);

  const toComma = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');

  // Rellenar formulario con valores existentes
  const onEdit = (plant) => {
    const t = plant.taxonomy && typeof plant.taxonomy === 'object' ? plant.taxonomy : {};
    setSelectedId(plant.id);
    setOriginal(plant);
    setForm({
      entity_name: plant.entity_name || '',
      scientific_name: plant.scientific_name || '',
      common_names: toComma(plant.common_names || []),
      images: toComma(plant.images || []),
      taxonomy_kingdom: t.kingdom || '',
      taxonomy_phylum: t.phylum || t.division || '',
      taxonomy_class: t.class || t.classis || '',
      taxonomy_order: t.order || '',
      taxonomy_family: t.family || '',
      taxonomy_genus: t.genus || '',
      taxonomy_species: t.species || '',
      description: plant.description || '',
      access_token: plant.access_token || ''
    });
    setMsg('');
  };

  // Crear (sin relación a edición)
  const onCreate = async () => {
    setMsg('');
    try {
      const payload = buildCreatePayload(form);
      await createPlant(payload);
      setMsg('Creado correctamente');
      await load(page);
      resetForm();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || 'Error al crear');
    }
  };

  // Guardar edición: enviar solo cambios
  const onSaveEdit = async () => {
    if (!selectedId || !original) {
      setMsg('Seleccione un registro para editar'); 
      return;
    }
    setMsg('');
    try {
      const payload = buildUpdateDiffPayload(original, form);
      if (Object.keys(payload).length === 0) {
        setMsg('No hay cambios para guardar');
        return;
      }
      await updatePlant(selectedId, payload);
      setMsg('Actualizado');
      await load(page);
      resetForm();
    } catch (e) {
      const details = e.response?.data?.details?.join(', ');
      setMsg(details || e.response?.data?.error || e.message || 'Error al actualizar');
    }
  };

    const resetForm = () => {
        setSelectedId(null);
        setOriginal(null);
        setForm({
            entity_name: '',
            scientific_name: '',
            common_names: '',
            images: '',
            taxonomy_kingdom: '',
            taxonomy_phylum: '',
            taxonomy_class: '',
            taxonomy_order: '',
            taxonomy_family: '',
            taxonomy_genus: '',
            taxonomy_species: '',
            description: '',
            access_token: ''
        });
    };

  const onToggle = async (id, to) => {
    setMsg('');
    try {
      await changePlantStatus(id, to);
      setMsg('Estado actualizado');
      await load(page);
      if (selectedId === id && to === 'inactive') {
        resetForm();
      }
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || 'Error al cambiar estado');
    }
  };

  const firstImage = (p) => (Array.isArray(p.images) && p.images.length ? p.images[0] : null);
  const taxonomyString = (t) => {
    if (!t || typeof t !== 'object') return '';
    const keys = ['kingdom','phylum','division','class','order','family','genus','species'];
    const parts = keys.map(k => t[k]).filter(Boolean);
    return parts.join(' • ');
  };

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0">Administrar Plantas</h2>
        <div className="d-flex align-items-center gap-2">
          <label htmlFor="statusFilter" className="form-label mb-0 me-2">Estado</label>
          <select
            id="statusFilter"
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </div>

      <div className="row g-4">
        {/* Formulario Crear/Editar */}
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-header">
              <strong>{selectedId ? `Editar #${selectedId}` : 'Crear nueva'}</strong>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Nombre de la planta</label>
                <input
                  className="form-control"
                  placeholder="Nombre de la planta"
                  value={form.entity_name}
                  onChange={e=>setForm({...form, entity_name: e.target.value})}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Nombre Científico</label>
                <input
                  className="form-control"
                  placeholder="Nombre Científico"
                  value={form.scientific_name}
                  onChange={e=>setForm({...form, scientific_name: e.target.value})}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Nombre Comunes (separados por coma)</label>
                <input
                  className="form-control"
                  placeholder="Nombre Comunes (coma)"
                  value={form.common_names}
                  onChange={e=>setForm({...form, common_names: e.target.value})}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Imágenes (URLs separadas por coma)</label>
                <input
                  className="form-control"
                  placeholder="Imágenes (coma)"
                  value={form.images}
                  onChange={e=>setForm({...form, images: e.target.value})}
                />
              </div>

              {/* Taxonomía por campos */}
              <div className="mb-2"><strong>Taxonomía</strong></div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label">Reino</label>
                  <input className="form-control" placeholder="Reino" value={form.taxonomy_kingdom} onChange={e=>setForm({...form, taxonomy_kingdom: e.target.value})} />
                </div>
                <div className="col-6">
                  <label className="form-label">Filo / División</label>
                  <input className="form-control" placeholder="Filo / División" value={form.taxonomy_phylum} onChange={e=>setForm({...form, taxonomy_phylum: e.target.value})} />
                </div>
                <div className="col-6">
                      <label className="form-label">Clase</label>
                  <input className="form-control" placeholder="Clase" value={form.taxonomy_class} onChange={e=>setForm({...form, taxonomy_class: e.target.value})} />
                </div>
                <div className="col-6">
                  <label className="form-label">Orden</label>
                  <input className="form-control" placeholder="Orden" value={form.taxonomy_order} onChange={e=>setForm({...form, taxonomy_order: e.target.value})} />
                </div>
                <div className="col-6">
                  <label className="form-label">Familia</label>
                  <input className="form-control" placeholder="Familia" value={form.taxonomy_family} onChange={e=>setForm({...form, taxonomy_family: e.target.value})} />
                </div>
                <div className="col-6">
                  <label className="form-label">Género</label>
                  <input className="form-control" placeholder="Género" value={form.taxonomy_genus} onChange={e=>setForm({...form, taxonomy_genus: e.target.value})} />
                </div>
                <div className="col-12">
                  <label className="form-label">Especies</label>
                  <input className="form-control" placeholder="Especies" value={form.taxonomy_species} onChange={e=>setForm({...form, taxonomy_species: e.target.value})} />
                </div>
              </div>

              <div className="mb-3 mt-2">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  placeholder="Descripción"
                  value={form.description}
                  onChange={e=>setForm({...form, description: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Token de Acceso</label>
                <input
                  className="form-control"
                  placeholder="Token de Acceso"
                  value={form.access_token}
                  onChange={e=>setForm({...form, access_token: e.target.value})}
                />
                <div className="form-text">Puedes actualizar el token si lo necesitas.</div>
              </div>

              <div className="d-flex gap-2">
                {!selectedId ? (
                  <button className="btn btn-primary" onClick={onCreate}>Crear</button>
                ) : (
                  <>
                    <button className="btn btn-success" onClick={onSaveEdit}>Guardar cambios</button>
                    <button className="btn btn-outline-secondary" onClick={resetForm}>Cancelar</button>
                  </>
                )}
              </div>

              {msg && (
                <div className="alert alert-info mt-3 mb-0" role="alert">
                  {msg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Listado */}
        <div className="col-12 col-lg-7">
          <div className="position-sticky" style={{ top: '1rem' }}>
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Listado</strong>
                <span className="badge text-bg-secondary">
                  {data ? `Total: ${data.total}` : 'Cargando...'}
                </span>
              </div>
              <div
                className="card-body"
                style={{
                  maxHeight: 'calc(100vh - 11rem)',
                  overflowY: 'auto'
                }}
              >
                {!data ? (
                  <div className="d-flex align-items-center">
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Cargando...
                  </div>
                ) : data.plants.length === 0 ? (
                  <div className="alert alert-warning mb-0">No hay plantas para mostrar</div>
                ) : (
                  <div className="row row-cols-1 g-3">
                    {data.plants.map((p) => {
                      const img = firstImage(p);
                      const tax = taxonomyString(p.taxonomy);
                      return (
                        <div className="col" key={p.id}>
                          <div className="card h-100">
                            <div className="card-body">
                              <div className="d-flex gap-3">
                                {img ? (
                                  <img
                                    src={img}
                                    alt={p.entity_name || p.scientific_name || 'Planta'}
                                    className="img-thumbnail"
                                    style={{ width: 96, height: 96, objectFit: 'cover' }}
                                  />
                                ) : (
                                  <div
                                    className="bg-light border d-flex align-items-center justify-content-center rounded"
                                    style={{ width: 96, height: 96 }}
                                    title="Sin imagen"
                                  >
                                    <span className="text-muted small">Sin imagen</span>
                                  </div>
                                )}

                                <div className="flex-grow-1">
                                  <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                      <h5 className="mb-1">{p.entity_name || 'Sin nombre'}</h5>
                                      <div className="text-muted small">#{p.id} · Estado: <span className={p.status === 'active' ? 'text-success' : 'text-danger'}>{p.status}</span></div>
                                    </div>
                                    <div className="d-flex gap-2">
                                      <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(p)}>
                                        Editar
                                      </button>
                                      {p.status === 'active' ? (
                                        <button className="btn btn-sm btn-outline-warning" onClick={() => onToggle(p.id, 'inactive')}>
                                          Inactivar
                                        </button>
                                      ) : (
                                        <button className="btn btn-sm btn-outline-success" onClick={() => onToggle(p.id, 'active')}>
                                          Activar
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-2">
                                    <div><strong>Nombre científico:</strong> {p.scientific_name || <span className="text-muted">No hay</span>}</div>
                                    <div><strong>Nombres comunes:</strong> {Array.isArray(p.common_names) && p.common_names.length ? p.common_names.join(', ') : <span className="text-muted">No hay</span>}</div>
                                    <div><strong>Taxonomía:</strong> {tax ? tax : <span className="text-muted">No hay</span>}</div>
                                    <div className="mt-2">
                                      <strong>Descripción:</strong>
                                      <div className="text-body-secondary">
                                        {p.description ? p.description : <span className="text-muted">No hay</span>}
                                      </div>
                                    </div>
                                    <div className="mt-2">
                                      <strong>Token:</strong> {p.access_token ? <code>{p.access_token}</code> : <span className="text-muted">No hay</span>}
                                    </div>
                                    {Array.isArray(p.images) && p.images.length > 1 && (
                                      <div className="mt-2">
                                        <strong>Imágenes:</strong>
                                        <div className="d-flex flex-wrap gap-2 mt-1">
                                          {p.images.slice(1, 6).map((url, idx) => (
                                            <img key={idx} src={url} alt={`img-${idx}`} className="rounded border" style={{ width: 56, height: 56, objectFit: 'cover' }} />
                                          ))}
                                          {p.images.length > 6 && (
                                            <span className="badge text-bg-light align-self-center">+{p.images.length - 6} más</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="card-footer d-flex justify-content-between align-items-center">
                              <small className="text-muted">Actualizado: {new Date(p.updated_at || p.created_at).toLocaleString()}</small>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Paginación */}
              {data && (
                <div className="card-footer d-flex flex-wrap gap-2 justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
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
                  <span className="text-muted">
                    Página {data.page} / {data.totalPages} · Límite 10
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Construye payload de creación
function buildCreatePayload(form) {
  return {
    entity_name: form.entity_name,
    scientific_name: form.scientific_name || null,
    common_names: splitComma(form.common_names),   // array o []
    taxonomy: buildTaxonomyFromForm(form),         // objeto o null
    description: form.description || null,
    images: splitComma(form.images),               // array o []
    access_token: form.access_token || null
  };
}

// Construye diff para update: solo campos modificados
function buildUpdateDiffPayload(original, form) {
  const payload = {};

  const fields = [
    'entity_name',
    'scientific_name',
    'description',
    'access_token'
  ];
  fields.forEach(f => {
    const newVal = (form[f] || '').trim();
    const oldVal = original[f] || '';
    if (newVal !== oldVal) {
      payload[f] = newVal || null;
    }
  });

  // common_names
  const newCommon = splitComma(form.common_names);
  const oldCommon = Array.isArray(original.common_names) ? original.common_names : [];
  if (!arraysEqual(newCommon, oldCommon)) {
    payload.common_names = newCommon.length ? newCommon : undefined; // si vacío, no tocar
  }

  // images
  const newImages = splitComma(form.images);
  const oldImages = Array.isArray(original.images) ? original.images : [];
  if (!arraysEqual(newImages, oldImages)) {
    payload.images = newImages.length ? newImages : undefined;
  }

  // taxonomy
  const newTax = buildTaxonomyFromForm(form);
  const oldTax = original.taxonomy && typeof original.taxonomy === 'object' ? original.taxonomy : null;
  if (!deepEqual(newTax, oldTax)) {
    if (newTax && Object.keys(newTax).length > 0) {
      payload.taxonomy = newTax;
    }
  }

  return payload;
}

function buildTaxonomyFromForm(form) {
  const t = {
    ...(form.taxonomy_kingdom && { kingdom: form.taxonomy_kingdom.trim() }),
    ...(form.taxonomy_phylum && { phylum: form.taxonomy_phylum.trim() }),
    ...(form.taxonomy_class && { class: form.taxonomy_class.trim() }),
    ...(form.taxonomy_order && { order: form.taxonomy_order.trim() }),
    ...(form.taxonomy_family && { family: form.taxonomy_family.trim() }),
    ...(form.taxonomy_genus && { genus: form.taxonomy_genus.trim() }),
    ...(form.taxonomy_species && { species: form.taxonomy_species.trim() })
  };
  return Object.keys(t).length ? t : null;
}

function splitComma(s) {
  if (!s || !s.trim()) return [];
  return s.split(',').map(x => x.trim()).filter(Boolean);
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const A = [...a].sort(); const B = [...b].sort();
  return A.every((v, i) => v === B[i]);
}
function deepEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}