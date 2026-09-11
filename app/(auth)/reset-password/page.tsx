import { PasswordForm } from "@/components/auth/password-form";
export default function ResetPasswordPage() { return <><div className="auth-heading"><h1>Redefinir senha</h1><p>Escolha uma nova senha com pelo menos 8 caracteres.</p></div><PasswordForm mode="update" /></>; }
