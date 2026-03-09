import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import { CheckCircle, AlertCircle, ArrowLeft, Camera, MapPin } from 'lucide-react';

export default function SignContract() {
  const { loanId, contractId } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [clientFields, setClientFields] = useState<string[]>([]);
  const [signatureFields, setSignatureFields] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [previewContent, setPreviewContent] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [idPhotoBase64, setIdPhotoBase64] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const sigCanvasRefs = useRef<{ [key: string]: SignatureCanvas | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }

      if (!loanId || !contractId) {
        setError('Parámetros inválidos');
        setLoading(false);
        return;
      }

      try {
        const [loanDoc, contractDoc] = await Promise.all([
          getDoc(doc(db, 'loans', loanId)),
          getDoc(doc(db, 'contracts', contractId))
        ]);

        if (!loanDoc.exists() || !contractDoc.exists()) {
          setError('Préstamo o contrato no encontrado');
          setLoading(false);
          return;
        }

        const loanData = loanDoc.data();
        
        if (loanData.clientId !== auth.currentUser.uid) {
          setError('No tienes permiso para ver este contrato');
          setLoading(false);
          return;
        }

        if (loanData.contractSigned) {
          setError('Este contrato ya ha sido firmado');
          setLoading(false);
          return;
        }

        const clientDoc = await getDoc(doc(db, 'clients', loanData.clientId));
        if (clientDoc.exists()) setClient(clientDoc.data());

        setLoan({ id: loanDoc.id, ...loanData });
        const contractData = { id: contractDoc.id, ...contractDoc.data() } as any;
        setContract(contractData);

        // Parse fields
        const clientRegex = /\[cliente:(.*?)\]/g;
        const cMatches = [...(contractData.content || '').matchAll(clientRegex)];
        const clientFieldsList: string[] = [];
        let cIdx = 0;
        cMatches.forEach((m: any) => {
          if (!m[1].endsWith('_Admin')) {
            clientFieldsList.push(`${m[1]}_${cIdx++}`);
          }
        });
        setClientFields(clientFieldsList);

        const sigRegex = /\[firma:(.*?)\]/g;
        const sMatches = [...(contractData.content || '').matchAll(sigRegex)];
        setSignatureFields(sMatches.map((m: any, index: number) => `${m[1]}_${index}`));

      } catch (err: any) {
        setError('Error al cargar datos: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [loanId, contractId, navigate]);

  useEffect(() => {
    if (!contract || !loan || !client) return;

    let content = contract.content;
    
    // Replace system variables
    content = content.replace(/\{\{cliente_nombre\}\}/g, `${client.firstName} ${client.lastName}`);
    content = content.replace(/\{\{cliente_cedula\}\}/g, client.documentId);
    content = content.replace(/\{\{prestamo_monto\}\}/g, `$${loan.amount.toLocaleString()}`);
    content = content.replace(/\{\{fecha_actual\}\}/g, new Date().toLocaleDateString());

    // Replace client fields with active contenteditable spans
    let clientIndex = 0;
    content = content.replace(/\[cliente:(.*?)\]/g, (match, fieldName) => {
      if (fieldName.endsWith('_Admin')) return match; // Leave for admin replacement
      const uniqueFieldId = `${fieldName}_${clientIndex++}`;
      const val = fieldValues[uniqueFieldId] || '';
      return `<span contenteditable="true" data-client-field="${uniqueFieldId}" data-placeholder="${fieldName}" class="inline-block min-w-[150px] border-b-2 border-emerald-500 bg-emerald-50 px-2 py-1 text-emerald-900 focus:outline-none focus:border-emerald-700 focus:bg-emerald-100 transition-colors mx-1 empty:before:content-[attr(data-placeholder)] empty:before:text-emerald-300 cursor-text">${val}</span>`;
    });

    // Replace admin fields with disabled spans
    const adminValues = loan.contractData?.adminValues || {};
    let adminIndex = 0;
    content = content.replace(/\[admin:(.*?)\]|\[cliente:(.*?_Admin)\]/g, (match, g1, g2) => {
      const fieldName = g1 || g2;
      const uniqueFieldId = `${fieldName}_${adminIndex++}`;
      const val = adminValues[uniqueFieldId] || '';
      return `<span class="inline-block min-w-[150px] border-b-2 border-slate-300 bg-slate-100 px-2 py-1 text-slate-700 cursor-not-allowed mx-1 font-bold">${val}</span>`;
    });

    // Replace signatures with placeholders
    let sigIndex = 0;
    content = content.replace(/\[firma:(.*?)\]/g, (match, fieldName) => {
      const uniqueFieldId = `${fieldName}_${sigIndex++}`;
      return `<span class="bg-purple-200 text-purple-900 px-2 py-1 rounded mx-1">[Firma requerida abajo: ${fieldName}]</span>`;
    });

    setPreviewContent(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, loan, client, clientFields, signatureFields]);

  useEffect(() => {
    if (containerRef.current && previewContent && !containerRef.current.innerHTML) {
      containerRef.current.innerHTML = previewContent;
    }
  }, [previewContent]);

  const handleContainerInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const span = target.closest('span[data-client-field]') as HTMLElement;
    if (span && span.dataset.clientField) {
      const field = span.dataset.clientField;
      const val = span.innerText;
      setFieldValues(prev => ({ ...prev, [field]: val }));
    }
  };

  const handleSign = async () => {
    try {
      if (!idPhotoBase64) {
        return alert('Por favor suba una foto de su cédula.');
      }
      if (!location) {
        return alert('Por favor permita el acceso a su ubicación.');
      }

      // Harvest latest values from DOM to ensure we capture all contenteditable changes
      const container = document.querySelector('.prose');
      const currentValues = { ...fieldValues };
      if (container) {
        const spans = container.querySelectorAll('span[data-client-field]');
        spans.forEach(span => {
          const field = (span as HTMLElement).dataset.clientField;
          if (field) {
            currentValues[field] = (span as HTMLElement).innerText.trim();
          }
        });
      }

      // Validate signatures
      const signaturesData: Record<string, string> = {};
      for (const field of signatureFields) {
        const canvas = sigCanvasRefs.current[field];
        if (!canvas || canvas.isEmpty()) {
          const fieldName = field.substring(0, field.lastIndexOf('_'));
          return alert(`Por favor proporcione la firma: ${fieldName}`);
        }
        signaturesData[field] = canvas.getTrimmedCanvas().toDataURL('image/png');
      }

      if (!termsAccepted) {
        return alert('Por favor acepte los términos y condiciones para continuar.');
      }

      await updateDoc(doc(db, 'loans', loanId!), {
        contractSigned: true,
        contractSignedAt: new Date().toISOString(),
        idPhotoBase64,
        location,
        'contractData.clientValues': currentValues,
        'contractData.signatures': signaturesData
      });

      setSuccess(true);
    } catch (err: any) {
      alert('Error al firmar: ' + err.message);
    }
  };

  const clearSignature = (field: string) => {
    sigCanvasRefs.current[field]?.clear();
  };

  const handleIdPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getLocation = () => {
    setIsGettingLocation(true);
    setLocationError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsGettingLocation(false);
        },
        (error) => {
          setLocationError('No se pudo obtener la ubicación. Por favor permita el acceso.');
          setIsGettingLocation(false);
        }
      );
    } else {
      setLocationError('La geolocalización no es soportada por este navegador.');
      setIsGettingLocation(false);
    }
  };

  const allClientFieldsFilled = clientFields.length === 0 || clientFields.every(field => fieldValues[field] && fieldValues[field].trim() !== '');
  const canSign = allClientFieldsFilled && termsAccepted;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Cargando contrato...</div>;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="card-modern p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button onClick={() => navigate(-1)} className="btn-primary w-full">
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="card-modern p-8 max-w-md w-full text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Contrato Firmado!</h2>
          <p className="text-slate-600 mb-6">El contrato ha sido firmado exitosamente. Los administradores serán notificados.</p>
          <button onClick={() => navigate('/client/my-loans')} className="btn-primary w-full bg-emerald-600 hover:bg-emerald-700">
            Ir a Mis Préstamos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <button onClick={() => navigate(-1)} className="flex items-center text-slate-500 hover:text-slate-900 font-medium transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Volver
        </button>

        <div className="card-modern">
          <div className="bg-indigo-600 px-6 py-5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Firma de Contrato</h1>
            <p className="text-indigo-100 mt-1 font-medium">Préstamo: {loan.loanTypeName} - ${loan.amount.toLocaleString()}</p>
          </div>
          
          <div className="p-6 md:p-8 space-y-8">
            
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">Documento del Contrato</h3>
              
              {clientFields.length > 0 && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start">
                  <CheckCircle size={20} className="text-emerald-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Campos requeridos</h4>
                    <p className="text-sm text-emerald-700 mt-1">
                      Por favor, completa los campos resaltados en el documento a continuación antes de firmar.
                    </p>
                  </div>
                </div>
              )}

              <div 
                ref={containerRef}
                className="prose prose-slate max-w-none prose-p:leading-relaxed bg-white p-6 rounded-lg border border-slate-200"
                onInput={handleContainerInput}
              />
            </div>

            {signatureFields.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 tracking-tight">Firmas Digitales</h3>
                <div className="grid grid-cols-1 gap-6">
                  {signatureFields.map((field) => (
                    <div key={field}>
                      <p className="text-sm font-medium text-slate-700 mb-2">Firma: {field}</p>
                      <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative overflow-hidden">
                        <SignatureCanvas 
                          ref={(ref: any) => sigCanvasRefs.current[field] = ref}
                          penColor="black"
                          canvasProps={{ className: 'w-full h-48 cursor-crosshair' }}
                        />
                        <button 
                          onClick={() => clearSignature(field)}
                          className="absolute top-3 right-3 text-xs font-medium bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-slate-600"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">Requisitos Adicionales</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Foto de Cédula */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center mb-3">
                      <Camera className="text-indigo-600 mr-2" size={20} />
                      <h4 className="font-bold text-slate-900">Foto de Cédula</h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">Sube una foto clara de tu documento de identidad.</p>
                    
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleIdPhotoUpload}
                      className="hidden"
                      id="id-photo-upload"
                    />
                    <label 
                      htmlFor="id-photo-upload"
                      className="btn-secondary w-full flex justify-center cursor-pointer"
                    >
                      {idPhotoBase64 ? 'Cambiar Foto' : 'Subir Foto'}
                    </label>
                    {idPhotoBase64 && (
                      <div className="mt-3">
                        <img src={idPhotoBase64} alt="Cédula" className="h-24 object-cover rounded-lg border border-slate-200" />
                      </div>
                    )}
                  </div>

                  {/* Ubicación */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center mb-3">
                      <MapPin className="text-indigo-600 mr-2" size={20} />
                      <h4 className="font-bold text-slate-900">Ubicación Actual</h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">Requerimos tu ubicación actual para el expediente.</p>
                    
                    <button 
                      onClick={getLocation}
                      disabled={isGettingLocation || location !== null}
                      className={`btn-secondary w-full flex justify-center ${location ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}`}
                    >
                      {isGettingLocation ? 'Obteniendo...' : location ? 'Ubicación Capturada' : 'Obtener Ubicación'}
                    </button>
                    {locationError && <p className="text-red-500 text-xs mt-2">{locationError}</p>}
                    {location && (
                      <p className="text-emerald-600 text-xs mt-2 font-medium">Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    required
                    className="focus:ring-indigo-500 h-5 w-5 text-indigo-600 border-slate-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="font-bold text-slate-900">Acepto los términos y condiciones</label>
                  <p className="text-slate-500 mt-1">Al firmar este documento, acepto todas las condiciones estipuladas en el contrato y reconozco mi obligación de pago.</p>
                </div>
              </div>

              <button
                onClick={handleSign}
                className="w-full btn-primary py-3.5 text-base bg-emerald-600 hover:bg-emerald-700"
              >
                Confirmar y Firmar Contrato
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
