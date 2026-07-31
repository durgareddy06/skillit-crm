import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import { Field, Input, PhoneInput } from "../components/Field";

const FALLBACK_LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%233b6ea5"/><path d="M16 8l7 3.5-7 3.5-7-3.5L16 8z" fill="%23fff"/><path d="M9 15v4l7 3.5 7-3.5v-4l-7 3.5-7-3.5z" fill="%23bfdbfe"/></svg>'
  );

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(phone.trim(), password);
    setLoading(false);
    if (!result.ok) return setError(result.message);
    navigate("/");
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-skillit-bg">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-skillit via-skillit-dark to-slate-900 text-white p-10 relative overflow-hidden">
        <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-white/5" />
        <div className="flex items-center gap-3 relative">
          <img
            src="/skillit_logo.svg"
            alt="SkillIT Academy"
            className="h-10 w-10 rounded-lg object-cover"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_LOGO; }}
          />
          
        </div>

        <div className="relative animate-fadeIn">
          <h1 className="font-display text-3xl font-bold leading-tight mb-3">
            One CRM for every student's journey.
          </h1>
          <p className="text-blue-100 max-w-sm data-font">
            From the first payment link to orientation, track Sales, MIS and
            Customer Support workflows in a single place.
          </p>
        </div>

        <p className="text-xs text-blue-200 relative">© 2026 SkillIT Academy. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-slate-100 p-8 animate-popIn"
        >
          <img
            src="/skillit_logo.svg"
            alt="SkillIT Academy"
            className="h-10 w-10 rounded-lg object-cover mb-4 md:hidden"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_LOGO; }}
          />
          <h2 className="font-display text-xl font-bold text-slate-800">Welcome back</h2>
          <p className="text-sm text-slate-400 mb-6">Sign in with your registered phone number.</p>

          <div className="space-y-4">
            <Field label="Phone number" required>
              <PhoneInput
                placeholder="8639555275"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-4 animate-fadeIn">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-6">
            Log in
          </Button>

          <div className="mt-6 text-xs text-slate-400 bg-slate-50 rounded-xl p-3 leading-relaxed">
            Login uses the MongoDB-backed account list. The seeded admin account is{" "}
            <span className="font-medium text-slate-500">9998887766</span> with password{" "}
            <span className="font-medium text-slate-500">skillit@123</span>.
          </div>
        </form>
      </div>
    </div>
  );
}
