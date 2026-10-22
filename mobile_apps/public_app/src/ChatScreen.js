import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { ArrowLeftIcon, SendIcon, WaterDropIcon } from './Icons';

export default function ChatScreen({ onBack, waterLevel = 0.0, alertKey = 'NORMAL', gatePercent = 0 }) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'msg-1',
      sender: 'BOT',
      text: "Hello! I'm your Smart Dam assistant. How can I help you today?",
      time: '09:12 AM'
    }
  ]);
  const scrollViewRef = useRef();

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: userText,
      time: userTime
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Generate intelligent Smart Dam live telemetry reply
    setTimeout(() => {
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let replyText = '';
      const lower = userText.toLowerCase();

      if (lower.includes('water') || lower.includes('level') || lower.includes('height')) {
        const heightM = ((waterLevel / 100) * 3.0).toFixed(2);
        const heightCm = Math.round((waterLevel / 100) * 300);
        const statusText = alertKey === 'NORMAL' ? 'It is currently safe.' : `System status: ${alertKey}. Please exercise caution.`;
        replyText = `The current water level is ${heightM} m (${heightCm} cm), which is ${waterLevel.toFixed(0)}% of capacity. ${statusText}`;
      } else if (lower.includes('gate') || lower.includes('open') || lower.includes('close')) {
        replyText = `The sluice gate is currently ${gatePercent > 0 ? `OPEN at ${gatePercent}%` : 'CLOSED'}. Gates are operated automatically according to reservoir water level and flood safety protocols.`;
      } else if (lower.includes('flood') || lower.includes('danger') || lower.includes('safe') || lower.includes('evacuat')) {
        if (alertKey === 'NORMAL') {
          replyText = `Kantalai Reservoir is currently operating under NORMAL conditions. There is no flood danger at this time.`;
        } else {
          replyText = `Current Alert State: ${alertKey}. Please stay away from riverbanks and spillway channels. Follow official evacuation advisories.`;
        }
      } else if (lower.includes('weather') || lower.includes('rain')) {
        replyText = `The weather at Kantalai Reservoir is Partly Cloudy, 28°C with 78% humidity. Upstream catchment sensors are monitoring inflow.`;
      } else {
        replyText = `I am monitoring Kantalai Reservoir 24/7. Current water level: ${((waterLevel / 100) * 3.0).toFixed(2)} m (${waterLevel.toFixed(0)}%), Gate: ${gatePercent}%, Status: ${alertKey}. How else can I assist you?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: 'bot-' + Date.now(),
          sender: 'BOT',
          text: replyText,
          time: botTime
        }
      ]);
    }, 600);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <ArrowLeftIcon size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Bot Profile Header Banner */}
        <View style={styles.botBanner}>
          <View style={styles.botAvatar}>
            <WaterDropIcon size={22} color="#0284C7" />
          </View>
          <View>
            <Text style={styles.botName}>Smart Dam</Text>
            <Text style={styles.botStatus}>Online • Automated Hydro Assistant</Text>
          </View>
        </View>

        {/* Message Stream */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'USER';
            return (
              <View
                key={m.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowBot
                ]}
              >
                {!isUser && (
                  <View style={styles.msgAvatar}>
                    <WaterDropIcon size={16} color="#0284C7" />
                  </View>
                )}

                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.bubbleUser : styles.bubbleBot
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      isUser ? styles.bubbleTextUser : styles.bubbleTextBot
                    ]}
                  >
                    {m.text}
                  </Text>
                  <Text
                    style={[
                      styles.timeText,
                      isUser ? styles.timeTextUser : styles.timeTextBot
                    ]}
                  >
                    {m.time} {isUser && '✓✓'}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Bottom Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <SendIcon size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  botBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  botAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  botName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  botStatus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500'
  },
  chatScroll: {
    flex: 1
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end'
  },
  messageRowBot: {
    justifyContent: 'flex-start'
  },
  messageRowUser: {
    justifyContent: 'flex-end'
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  bubbleBot: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4
  },
  bubbleUser: {
    backgroundColor: '#0284C7',
    borderBottomRightRadius: 4
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20
  },
  bubbleTextBot: {
    color: '#1E293B'
  },
  bubbleTextUser: {
    color: '#FFFFFF'
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end'
  },
  timeTextBot: {
    color: '#94A3B8'
  },
  timeTextUser: {
    color: '#E0F2FE'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginRight: 10
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
