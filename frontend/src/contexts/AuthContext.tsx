"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi, tokenStorage, User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isModuleCoordinator: (module: ModuleCoordinator["module"], level?: ModuleCoordinator["level"], resourceId?: number) => boolean;
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean;
}

type ModuleType = ModuleCoordinator["module"];
type CoordinatorLevel = ModuleCoordinator["level"];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = tokenStorage.getAccessToken();
      if (token) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData.data);
        } catch (error) {
          // Token invalid or expired
          tokenStorage.clearTokens();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Auto-refresh token before expiration
  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return;

    // Set up interval to refresh token every 14 minutes (before 15 min expiration)
    const interval = setInterval(async () => {
      try {
        await authApi.refreshToken();
      } catch (error) {
        // Refresh failed, logout user
        tokenStorage.clearTokens();
        setUser(null);
      }
    }, 14 * 60 * 1000); // 14 minutes

    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(
    async (username: string, password: string, rememberMe: boolean = false) => {
      try {
        const response = await authApi.login(username, password, rememberMe);
        setUser(response.user);
        
        // Redirect to change password page if needed
        if (response.user.must_change_password || (response.user as any).first_login) {
          router.push("/change-password");
        }
      } catch (error: any) {
        let errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Login failed. Please try again.";

        // If message is generic, try to extract from details
        if (
          error.response?.data?.details &&
          (errorMessage === "Invalid credentials" ||
            errorMessage === "Login failed. Please try again.")
        ) {
          const details = error.response.data.details;
          // Check for non_field_errors (common for ValidationError)
          if (details.non_field_errors && Array.isArray(details.non_field_errors)) {
            errorMessage = details.non_field_errors[0];
          } else if (Array.isArray(details) && details.length > 0) {
            errorMessage = details[0];
          } else if (typeof details === "string") {
            errorMessage = details;
          }
        }

        throw new Error(errorMessage);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Even if logout fails, clear tokens locally
      console.error("Logout error:", error);
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.getCurrentUser();
      setUser(response.data);
    } catch (error) {
      // User data fetch failed, logout
      tokenStorage.clearTokens();
      setUser(null);
      throw error;
    }
  }, []);

  const isModuleCoordinator = useCallback((
    module: ModuleType,
    level?: CoordinatorLevel,
    resourceId?: number
  ): boolean => {
    if (!user || !user.module_coordinator_assignments) {
      return false;
    }
    
    let assignments = user.module_coordinator_assignments.filter(
      (assignment) => assignment.module === module
    );
    
    if (level) {
      assignments = assignments.filter((assignment) => assignment.level === level);
    }
    
    if (resourceId !== undefined) {
      assignments = assignments.filter(
        (assignment) => assignment.resource_id === resourceId
      );
    }
    
    return assignments.length > 0;
  }, [user]);

  const isSeniorCoordinator = useCallback((module?: ModuleType): boolean => {
    if (!user || !user.module_coordinator_assignments) {
      return false;
    }
    
    let assignments = user.module_coordinator_assignments.filter(
      (assignment) => assignment.level === "SENIOR_COORDINATOR"
    );
    
    if (module) {
      assignments = assignments.filter((assignment) => assignment.module === module);
    }
    
    return assignments.length > 0;
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
    isModuleCoordinator,
    isSeniorCoordinator,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

