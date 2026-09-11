"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ShieldCheck, Trash2, X } from "lucide-react";
import type { ManagedUser, UserChanges, UserResult } from "@/features/users/schemas";
import { AccountStatusSelect } from "./account-status-select";
export const permissionOptions = [
  ["can_view","Visualizar calendário","Consultar as próprias ocorrências e métricas."],
  ["can_view_all","Visualizar todos","Incluir ocorrências de todos os autores. Requer visualizar calendário."],
  ["can_create","Criar ocorrências","Registrar indisponibilidades parciais ou de dia inteiro."],
  ["can_edit","Editar ocorrências","Alterar registros dentro do alcance de visualização."],
  ["can_delete","Excluir ocorrências","Remover registros dentro do alcance de visualização."],
  ["can_manage_users","Gerenciar usuários","Aprovar acessos e administrar membros e permissões."],
] as const;
export type SaveUser = (id: string, changes: UserChanges) => Promise<UserResult<{user:ManagedUser}>>;
export type DeleteUser = (id: string) => Promise<UserResult<{id:string}>>;
export function UserEditor({ user, currentUserId, onSave, onDelete, onClose }: { user: ManagedUser; currentUserId: string; onSave: SaveUser; onDelete: DeleteUser; onClose: () => void }) {
  const [name,setName]=useState(user.full_name), [status,setStatus]=useState(user.status), [permissions,setPermissions]=useState(user.permissions);
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [confirm,setConfirm]=useState(false);
  const panel=useRef<HTMLDivElement>(null), close=useRef<HTMLButtonElement>(null);
  const protectedUser=user.role==="owner"||user.id===currentUserId;
  useEffect(() => {
    const previous=document.activeElement as HTMLElement|null, overflow=document.body.style.overflow;
    document.body.style.overflow="hidden"; close.current?.focus();
    return () => { document.body.style.overflow=overflow; previous?.focus(); };
  },[]);
  useEffect(() => { if (confirm) panel.current?.querySelector<HTMLButtonElement>(".users-confirm-cancel")?.focus(); },[confirm]);
  function keyboard(event:KeyboardEvent<HTMLDivElement>) {
    if (event.key==="Escape") { event.stopPropagation(); if (!busy) { if(confirm) { setConfirm(false); close.current?.focus(); } else onClose(); } }
    if(event.key!=="Tab") return;
    const elements=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]');
    if(!elements?.length) return;
    const first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first) { event.preventDefault();last.focus(); }
    if(!event.shiftKey&&document.activeElement===last) { event.preventDefault();first.focus(); }
  }
  async function save() {
    if(busy||protectedUser) return;setBusy(true);setError("");
    try { const result=await onSave(user.id,{full_name:name,status,permissions}); if(result.ok) onClose();else setError(result.message); }
    catch { setError("Não foi possível salvar. Tente novamente."); } finally { setBusy(false); }
  }
  async function remove() {
    if(busy||protectedUser) return;setBusy(true);setError("");
    try { const result=await onDelete(user.id); if(result.ok) onClose();else setError(result.message); }
    catch { setError("Não foi possível excluir. Tente novamente."); } finally { setBusy(false); }
  }
  return <div className="users-modal-backdrop" onClick={event=>{if(event.target===event.currentTarget&&!busy) onClose();}}><div ref={panel} role={confirm?"alertdialog":"dialog"} aria-modal="true" aria-labelledby="user-editor-title" aria-describedby="user-editor-description" className="users-modal-card" onKeyDown={keyboard}>
    <header className="users-modal-heading"><div><h2 id="user-editor-title">{confirm?"Excluir usuário?":"Editar usuário"}</h2><p id="user-editor-description">{user.email}</p></div><button className="icon-button" aria-label="Fechar editor" ref={close} disabled={busy} onClick={onClose}><X size={19}/></button></header>
    {confirm ? <div className="users-editor-body"><p className="users-warning">O acesso de {user.full_name} será removido permanentemente. As ocorrências registradas serão preservadas, sem vínculo com a conta excluída.</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="users-editor-footer"><button className="button-quiet users-confirm-cancel" disabled={busy} onClick={()=>{setConfirm(false);setError("");close.current?.focus();}}>Manter usuário</button><button className="button-danger" disabled={busy} onClick={remove}>{busy?"Excluindo…":"Confirmar exclusão"}</button></div></div> :
    <form className="users-editor-body" onSubmit={event=>{event.preventDefault();void save();}}>
      {protectedUser&&<p className="users-protection">{user.role==="owner"?"Contas owner são protegidas: não podem ser alteradas, suspensas ou excluídas neste painel. Isso mantém sempre um administrador responsável.":"Sua própria conta é protegida. Peça a outro administrador para revisar seu acesso."}</p>}
      <fieldset disabled={busy||protectedUser} className="users-editor-fields"><div className="users-editor-grid"><label>Nome completo<input className="users-field" value={name} onChange={e=>setName(e.target.value)} required maxLength={200}/></label><div><span className="users-field-label">Status da conta</span><AccountStatusSelect value={status} onChange={setStatus} disabled={busy||protectedUser}/></div></div>
      <section className="users-permissions"><h3><ShieldCheck size={18}/>Permissões individuais</h3><p>A aprovação libera o acesso conforme estas permissões. Ações no calendário também exigem visualização.</p><div className="users-permission-grid">{permissionOptions.map(([key,label,description])=><label className="permission-option" key={key}><input className="sr-only" type="checkbox" checked={user.role==="owner"||permissions[key]} onChange={e=>setPermissions({...permissions,[key]:e.target.checked})}/><span aria-hidden="true" className="users-check" data-checked={user.role==="owner"||permissions[key]}>{(user.role==="owner"||permissions[key])&&<Check size={12}/>}</span><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></section></fieldset>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="users-editor-footer"><button className="button-danger users-delete" type="button" disabled={busy||protectedUser} onClick={()=>{setConfirm(true);setError("");}}><Trash2 size={15}/>Excluir usuário</button><button className="button-quiet" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="button-gold" disabled={busy||protectedUser}>{busy?"Salvando…":"Salvar alterações"}</button></div>
    </form>}
  </div></div>;
}
