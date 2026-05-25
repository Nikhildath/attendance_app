import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Mail, User, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Attendly" },
      { name: "description", content: "Access your Attendly dashboard to manage attendance, payroll, and team productivity." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message ?? "Unable to process your request. Please check your credentials.");
    }
  }

  return (
    <div className="min-h-screen flex bg-background selection:bg-primary/30 font-sans antialiased overflow-hidden">
      {/* Left Side: Illustration & Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-center p-16 xl:p-24 bg-zinc-950 border-r border-border/10 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary-glow/10 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />
        </div>

        <div className="relative z-10 space-y-12">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-default">
             <div className="p-1 bg-primary/20 rounded-2xl border border-primary/30 shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-500">
                <img src="/icon-192.png" alt="Attendly" className="w-8 h-8" />
             </div>
             <span className="text-3xl font-black tracking-tighter text-white">Attendly</span>
           </div>

          {/* Text Content */}
          <div className="max-w-xl space-y-6">
            <h2 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
              Manage workforce <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-glow italic">with precision.</span>
            </h2>
            <p className="text-zinc-400 text-xl leading-relaxed max-w-md">
              Join thousands of teams automating attendance and streamlining payroll with real-time insights.
            </p>
          </div>

          {/* Illustration Container */}
          <div className="relative group perspective-1000">
             <div className="relative w-full aspect-[4/3] max-w-[540px] animate-in fade-in zoom-in duration-1000 slide-in-from-bottom-10">
                <img 
                  src="/assets/login-illustration.png" 
                  alt="Attendly Illustration" 
                  className="w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:translate-y-[-8px] transition-transform duration-700"
                />
                
                {/* Floating UI Badges for extra polish */}
                <div className="absolute top-[20%] right-[10%] p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl animate-bounce duration-[3000ms]">
                   <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div className="absolute bottom-[20%] left-[5%] p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl animate-pulse">
                   <Zap className="w-6 h-6 text-primary-glow" />
                </div>
             </div>
          </div>
        </div>

        {/* Copyright at bottom */}
        <div className="absolute bottom-12 left-16 xl:left-24 z-10">
          <p className="text-zinc-600 text-sm font-medium">© 2026 Attendly Inc. All rights reserved.</p>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Decorative Background for Right Side */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[150px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary-glow/5 blur-[150px] translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="w-full max-w-[460px] relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-10">
             <div className="flex items-center gap-2">
               <div className="p-1 bg-primary/10 rounded-xl border border-primary/20">
                 <img src="/icon-192.png" alt="Attendly" className="w-6 h-6" />
               </div>
               <span className="text-2xl font-bold tracking-tight">Attendly</span>
             </div>
           </div>

          {/* Form Card */}
          <div className="glass p-8 sm:p-10 rounded-[2.5rem] border border-border/50 shadow-2xl relative overflow-hidden group">
            {/* Subtle card internal glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[60px] group-hover:bg-primary/15 transition-colors duration-700" />
            
            <div className="relative z-10">
              <div className="mb-10">
                <h1 className="text-3xl font-black tracking-tight mb-3">
                  {isSignUp ? "Create account" : "Welcome back"}
                </h1>
                <p className="text-muted-foreground font-medium">
                  {isSignUp ? "Join our community today" : "Sign in to access your dashboard"}
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {isSignUp && (
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        type="text"
                        required
                        className="w-full h-14 rounded-2xl border border-input bg-background/50 px-12 py-2 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/5"
                        placeholder="e.g. Jane Cooper"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      required
                      className="w-full h-14 rounded-2xl border border-input bg-background/50 px-12 py-2 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/5"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Password</label>
                    {!isSignUp && (
                      <a href="#" className="text-xs font-bold text-primary hover:text-primary-glow transition-colors">
                        Forgot?
                      </a>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      required
                      className="w-full h-14 rounded-2xl border border-input bg-background/50 px-12 py-2 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/5"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-sm text-destructive flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}

                {!isSignUp && (
                  <div className="flex items-center gap-2.5 px-1 py-1">
                    <input 
                      type="checkbox" 
                      id="remember" 
                      className="h-5 w-5 rounded-lg border-input text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                    />
                    <label htmlFor="remember" className="text-sm font-medium text-muted-foreground cursor-pointer select-none">
                      Keep me signed in
                    </label>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-14 rounded-2xl text-base font-black shadow-elegant transition-all active:scale-[0.98] mt-4 gradient-primary" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>{isSignUp ? "Get Started" : "Sign In to Dashboard"}</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-10 pt-10 border-t border-border/50 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-muted-foreground font-medium hover:text-foreground transition-colors group"
                >
                  {isSignUp ? (
                    <>Already have an account? <span className="text-primary font-bold ml-1 group-hover:underline underline-offset-4">Sign in</span></>
                  ) : (
                    <>New to Attendly? <span className="text-primary font-bold ml-1 group-hover:underline underline-offset-4">Create account</span></>
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-[12px] text-muted-foreground/60 mt-12 px-6 font-medium leading-relaxed">
            By continuing, you agree to our <a href="#" className="text-foreground hover:underline underline-offset-4">Terms of Service</a> and <a href="#" className="text-foreground hover:underline underline-offset-4">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}


