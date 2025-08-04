"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TypingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  typingText: string
  typingSpeed?: number
  className?: string
  onSearch?: (query: string) => void
}

export function TypingInput({ typingText, typingSpeed = 100, className, onSearch, ...props }: TypingInputProps) {
  const [placeholder, setPlaceholder] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const [isFocused, setIsFocused] = useState(false)
  const [value, setValue] = useState("")

  useEffect(() => {
    if (!isTyping || isFocused) return

    let currentText = ""
    let currentIndex = 0

    const typingInterval = setInterval(() => {
      if (currentIndex < typingText.length) {
        currentText += typingText[currentIndex]
        setPlaceholder(currentText)
        currentIndex++
      } else {
        clearInterval(typingInterval)
        setIsTyping(false)

        // Reset after a delay to repeat the animation
        setTimeout(() => {
          setPlaceholder("")
          currentIndex = 0
          setIsTyping(true)
        }, 3000)
      }
    }, typingSpeed)

    return () => clearInterval(typingInterval)
  }, [typingText, typingSpeed, isTyping, isFocused])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      // Add to recent searches
      if ((window as any).addRecentSearch) {
        const type = value.match(/^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i) ? "postcode" : "area"
        ;(window as any).addRecentSearch(value.trim(), type)
      }

      // Call onSearch callback if provided
      if (onSearch) {
        onSearch(value.trim())
      }
    }
  }

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className={cn(className)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.target.value) {
          setIsFocused(false)
          setPlaceholder("")
          setIsTyping(true)
        }
      }}
      onKeyPress={handleKeyPress}
    />
  )
}
