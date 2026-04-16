"use client";

import { signIn, getSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const session = await getSession();
      if (session) {
        router.push("/");
      }
    };
    checkSession().catch((error) => {
      console.error("Error checking session:", error);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    setMessage("");

    try {
      const result = await signIn("email", { 
        email, 
        redirect: false 
      });
      
      if (result?.error) {
        if (result.error === "AccessDenied") {
          setMessage("Your email address is not authorized to access this application. Please contact an administrator.");
        } else {
          setMessage("Sign in failed. Please try again.");
        }
      } else {
        setMessage("Check your email for a sign-in link!");
      }
    } catch (_error) {
      setMessage("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-24 w-24 flex items-center justify-center rounded-full bg-gray-900">
            <div className="text-white text-4xl">🏁</div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Squishes Checkers
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your authorized email address to play
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading || !email}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending..." : "Sign in with Email"}
            </button>
          </div>
          {message && (
            <div className={`text-sm text-center ${message.includes("error") || message.includes("failed") || message.includes("not authorized") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}