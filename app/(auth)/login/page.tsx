import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><h1 className="sr-only">Entrar no Calendário F1</h1>{error === "callback" && <p role="alert" className="form-error">O link é inválido ou expirou. Solicite um novo link de recuperação ou tente entrar novamente.</p>}<LoginForm /></>;
}
