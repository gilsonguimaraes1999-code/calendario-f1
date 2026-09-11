"use client";
import { listUsers, updateUserAccess, deleteUser } from "@/features/users/actions";
import type { ManagedUser } from "@/features/users/schemas";
import { UsersPanel } from "./users-panel";
export function UsersWorkspace(props:{initialUsers:ManagedUser[];currentUserId:string;initialError?:string}) {
  return <UsersPanel {...props} onRefresh={listUsers} onSave={updateUserAccess} onDelete={deleteUser}/>;
}
