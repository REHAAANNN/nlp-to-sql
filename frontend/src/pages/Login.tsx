import { SignIn, SignUp } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';

const clerkAppearance = {
  variables: {
    colorPrimary: '#06b6d4',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#0f172a',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    borderRadius: '8px',
  },
  elements: {
    rootBox: 'w-full max-w-sm',
    card: 'w-full shadow-lg border border-gray-200 bg-white rounded-lg p-6',
    headerTitle: 'text-xl font-bold text-gray-900',
    headerSubtitle: 'text-sm text-gray-500 mt-1',
    socialButtonsBlockButton: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm py-2.5 rounded-md',
    formButtonPrimary: 'bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-sm py-2.5 rounded-md shadow-sm',
    footerActionText: 'text-sm text-gray-500',
    footerActionLink: 'text-sm text-cyan-600 hover:text-cyan-700 font-medium',
    formFieldLabel: 'text-sm font-medium text-gray-700 mb-1',
    formFieldInput: 'border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 w-full',
    dividerLine: 'bg-gray-200',
    dividerText: 'text-xs text-gray-400',
    identityPreviewText: 'text-sm text-gray-600',
    identityPreviewEditButton: 'text-cyan-600 text-sm',
  },
} as const;

export default function Login() {
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'signup' ? 'signup' : 'signin';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-sky-100">
      <div className="flex flex-col items-center gap-5 w-full max-w-sm mx-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">SQL AI Assistant</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>
        {mode === 'signup' ? (
          <SignUp
            appearance={clerkAppearance}
            signInUrl="/login"
            forceRedirectUrl="/connect"
          />
        ) : (
          <SignIn
            appearance={clerkAppearance}
            signUpUrl="/login?mode=signup"
            forceRedirectUrl="/connect"
          />
        )}
      </div>
    </div>
  );
}