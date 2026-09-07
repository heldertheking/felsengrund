import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

interface AdminAuthState {
    isAuthenticated: boolean
    isChecking: boolean
    isLoginModalOpen: boolean
    openLoginModal: () => void
    closeLoginModal: () => void
    login: (password: string) => Promise<boolean>
    logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthState | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isChecking, setIsChecking] = useState(true)
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

    useEffect(() => {
        fetch('/api/admin/session', { credentials: 'include' })
            .then((res) => res.json() as Promise<{ authenticated: boolean }>)
            .then((data) => setIsAuthenticated(data.authenticated))
            .catch(() => setIsAuthenticated(false))
            .finally(() => setIsChecking(false))
    }, [])

    const login = useCallback(async (password: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password }),
        })
        setIsAuthenticated(res.ok)
        if (res.ok) setIsLoginModalOpen(false)
        return res.ok
    }, [])

    const logout = useCallback(async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        setIsAuthenticated(false)
    }, [])

    return (
        <AdminAuthContext.Provider
            value={{
                isAuthenticated,
                isChecking,
                isLoginModalOpen,
                openLoginModal: () => setIsLoginModalOpen(true),
                closeLoginModal: () => setIsLoginModalOpen(false),
                login,
                logout,
            }}
        >
            {children}
        </AdminAuthContext.Provider>
    )
}

export function useAdminAuth(): AdminAuthState {
    const context = useContext(AdminAuthContext)
    if (!context) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
    return context
}
