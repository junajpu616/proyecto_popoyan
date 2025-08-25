import React, { useState } from 'react';
import { getPlantDetailsByToken, getPlantDetailsByName } from '../api/plantApi';

export default function DetailsPage() {
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [details, setDetails] = useState(null);
  const [err, setErr] = useState('');

  const byToken = async () => {
    setErr('');
    try {
      const data = await getPlantDetailsByToken(token.trim());
      setDetails(data);
    } catch (e) {
      setErr(e.message);
      setDetails(null);
    }
  };

  const byName = async () => {
    setErr('');
    try {
      const { details } = await getPlantDetailsByName(name.trim());
      setDetails(details);
    } catch (e) {
      setErr(e.message);
      setDetails(null);
    }
  };

  return (
    <div>
      <h2>Detalles de planta</h2>
      <div>
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Access token" />
        <button onClick={byToken} disabled={!token.trim()}>Buscar por token</button>
      </div>
      <div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre de la planta" />
        <button onClick={byName} disabled={!name.trim()}>Buscar por nombre</button>
      </div>
      {err && <p style={{color:'red'}}>{err}</p>}
      {details && (
        <div>
          <h3>{details.name}</h3>
          {details.image?.value && <img src={details.image.value} alt={details.name} style={{maxWidth:300}} />}
          <p><strong>Taxonomía:</strong> {Object.entries(details.taxonomy||{}).map(([k,v]) => `${k}: ${v}`).join(', ')}</p>
          <p><strong>Nombres comunes:</strong> {(details.common_names||[]).join(', ')}</p>
          <p><strong>Descripción:</strong> {details.description?.value}</p>
          <p><strong>Rank:</strong> {details.rank}</p>
        </div>
      )}
    </div>
  );
}