"use client";

import type { InputHTMLAttributes } from "react";

type AuthFormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
};

export function AuthFormField({
  label,
  id,
  error,
  className = "",
  ...props
}: AuthFormFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
        {label}
        {props.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        id={id}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 ${
          error
            ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200"
            : "border-zinc-300 bg-white hover:border-zinc-400"
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm0 7.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm.5-3.5a.5.5 0 0 1-1 0V4a.5.5 0 0 1 1 0v1z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
