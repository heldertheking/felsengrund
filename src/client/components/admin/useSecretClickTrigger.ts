import { useCallback, useRef } from 'react'

/** Fires `onTrigger` once `clicksRequired` clicks land within `windowMs` of each other. */
export function useSecretClickTrigger(onTrigger: () => void, clicksRequired = 5, windowMs = 2000) {
    const countRef = useRef(0)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    return useCallback(() => {
        countRef.current += 1
        if (timerRef.current) clearTimeout(timerRef.current)

        if (countRef.current >= clicksRequired) {
            countRef.current = 0
            onTrigger()
            return
        }

        timerRef.current = setTimeout(() => {
            countRef.current = 0
        }, windowMs)
    }, [onTrigger, clicksRequired, windowMs])
}
