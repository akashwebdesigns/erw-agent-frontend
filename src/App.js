import React, { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {

  const API_URL = process.env.REACT_APP_ERW_AGENT_URL;

  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi 👋 I’m your ERW AI Assistant.\nYou can create incidents or ask insurance rule questions."
    }
  ]);

  const [input, setInput] = useState("");
  const [collectedData, setCollectedData] = useState({});
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /* ===============================
     TYPEWRITER EFFECT
  ================================= */

  const typeMessage = async (text, speed = 15) => {
    setMessages(prev => [...prev, { role: "ai", text: "" }]);

    let current = "";

    for (let char of text) {
      current += char;
      await sleep(speed);

      const snapshot = current; // ✅ capture current value at this iteration

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          text: snapshot  // ✅ uses snapshot, not the outer 'current'
        };
        return updated;
      });
    }
  };

  /* ===============================
     THINKING DOTS
  ================================= */
  const thinkingDots = async (base = "🤖 Thinking") => {

    setMessages(prev => [...prev, { role: "ai", text: base }]);

    for (let i = 1; i <= 3; i++) {
      await sleep(400);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          text: `${base}${".".repeat(i)}`
        };
        return updated;
      });
    }
  };

  /* ===============================
     SEND MESSAGE
  ================================= */
  const sendMessage = async () => {

    if (!input.trim()) return;

    const userText = input.trim();

    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setInput("");

    await thinkingDots();

    try {

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userText,
          collected_data: collectedData
        })
      });

      const result = await res.json();

      console.log("CHAT RESPONSE:", result);

      /* ===============================
         RULE ANSWER
      ================================= */
      if (result.answer) {

        await typeMessage(`📚 Policy Rule:\n\n${result.answer}`);
        setCollectedData({});
        return;
      }

      /* ===============================
         INCOMPLETE DATA
      ================================= */
      if (result.status === "incomplete") {

        const labelMap = {
          state: "State",
          line: "Line",
          company: "Company",
          erw_code: "ERW Code",
          description: "Description"
        };

        const formatted = result.missing_fields
          .map(f => `• ${labelMap[f] || f}`)
          .join("\n");

        await typeMessage(
          `I still need the following information:\n\n${formatted}\n\nPlease provide all of them in one message.`
        );

        // handle both APIs
        setCollectedData(result.collected_data || result.extracted || {});
        return;
      }

      /* ===============================
         INCIDENT CREATED
      ================================= */
      if (result.status === "created") {

        await typeMessage(`✅ Incident created: ${result.created_incident}`);

        /* ===============================
           AUTO WA CONFIRMATION
        ================================= */
        if (result.workaround_posted) {

          await typeMessage(
            `🧠 Most relevant workaround has been automatically posted to the incident.\n\n` +
            `Source: ${result.posted_from_incident}`
          );

        } else {

          await typeMessage(
            "⚠️ No validated workaround met the confidence threshold for auto-posting."
          );
        }

        /* ===============================
           SHOW SUGGESTIONS
        ================================= */
        if (!result.suggestions || result.suggestions.length === 0) {

          await typeMessage(
            "⚠️ No historical workarounds found.\nPlease raise ITASK to Propagator team."
          );

          setCollectedData({});
          return;
        }

        await typeMessage("📌 Other relevant historical workarounds:");

        for (let s of result.suggestions) {

          await sleep(400);

          await typeMessage(
            `✔ ${s.incident_number} (${Math.round(s.confidence * 100)}% match)\n\n` +
            `${s.workaround || "No workaround available"}`
          );
        }

        setCollectedData({});
        return;
      }

    } catch (err) {

      await typeMessage("⚠️ Something went wrong. Please try again.");
      console.error(err);

    }
  };

  return (
    <div className="page">

      <div className="chat-container">

        <div className="header">
          🤖 ERW Auto-Triage Assistant
        </div>

        <div className="chat-box" ref={chatRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.text}
            </div>
          ))}
        </div>

        <div className="input-area">
          <input
            value={input}
            placeholder="Ask a rule question or describe an incident..."
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
        </div>

      </div>

    </div>
  );
}

export default App;