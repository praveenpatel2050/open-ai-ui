"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const appendMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // 1. Add user message
    appendMessage("user", inputText);

    // 2. Add empty assistant message for streaming
    appendMessage("assistant", "");

    const payload = {
      user_id: "sdf",
      mode: "coaching",
      text: inputText,
      thread_id: threadId,
    };

    setInputText(""); // clear input

    try {
      const response = await fetch("https://open-ai-poc-backend.onrender.com/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        chunk.split("\n").forEach((line) => {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace(/^data: /, "").trim();
            if (!dataStr || dataStr === "[DONE]") return;

            // Only parse JSON lines
            if (dataStr.startsWith("{")) {
              try {
                const dataObj = JSON.parse(dataStr);

                if (dataObj.type === "chunk") {
                  setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === "assistant") {
                      return [...prev.slice(0, -1), { role: "assistant", content: lastMsg.content + dataObj.value }];
                    } else {
                      return [...prev, { role: "assistant", content: dataObj.value }];
                    }
                  });
                }
                  if (dataObj.thread_id) setThreadId(dataObj.thread_id);

                } catch (err) {
                  console.error("JSON parse error:", err, dataStr);
                }
              }
              }
          });
      }
    } catch (err) {
      console.error("Streaming error:", err);
      appendMessage("assistant", "Error: " + (err as Error).message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{
        maxWidth: 700,
        margin: "20px auto",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        height: "80vh",
      }}
    >
      <h1 style={{ textAlign: "center" }}>Coaching Chat</h1>

      <div
        style={{
          flex: 1,
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: 10,
          overflowY: "auto",
          background: "#f9f9f9",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              margin: "5px 0",
              textAlign: msg.role === "user" ? "right" : "left",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 16,
                background: msg.role === "user" ? "#007bff" : "#e5e5ea",
                color: msg.role === "user" ? "white" : "black",
                maxWidth: "70%",
                wordBreak: "break-word",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={chatEndRef}></div>
      </div>

      <div style={{ display: "flex", marginTop: 10 }}>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={2}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            resize: "none",
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            marginLeft: 5,
            padding: "0 20px",
            borderRadius: 8,
            border: "none",
            background: "#007bff",
            color: "white",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
