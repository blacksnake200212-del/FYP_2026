import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from './supabaseClient';

export default function CommunityChatScreen({ t, onBack }) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'msg-1',
      sender_name: 'Tharindu',
      sender_role: 'CITIZEN',
      message: 'Water is flowing near the old bridge.',
      photo_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500',
      time: '09:15 AM',
      is_system: false
    },
    {
      id: 'msg-2',
      sender_name: 'Saman',
      sender_role: 'CITIZEN',
      message: 'Be careful everyone. Avoid this area.',
      photo_url: null,
      time: '09:18 AM',
      is_system: false
    },
    {
      id: 'msg-3',
      sender_name: 'System',
      sender_role: 'SYSTEM',
      message: t.reportUnderReview || 'This report is under verification by the operator.',
      photo_url: null,
      time: '09:20 AM',
      is_system: true
    }
  ]);

  const scrollViewRef = useRef();

  useEffect(() => {
    // Fetch latest community messages from Supabase
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('community_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(20);

        if (!error && data && data.length > 0) {
          const mapped = data.map((d) => ({
            id: d.id,
            sender_name: d.sender_name,
            sender_role: d.sender_role,
            message: d.message,
            photo_url: d.photo_url,
            time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            is_system: d.is_system
          }));
          setMessages(mapped);
        }
      } catch (err) {
        console.warn('Chat load err:', err.message);
      }
    };

    loadMessages();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const newMsg = {
      id: 'client-' + Date.now(),
      sender_name: 'You',
      sender_role: 'CITIZEN',
      message: inputText.trim(),
      photo_url: null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_system: false
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Attempt Supabase insert
    try {
      await supabase.from('community_messages').insert([
        {
          dam_id: 'KANTALAI-01',
          sender_name: 'You',
          sender_role: 'CITIZEN',
          message: newMsg.message,
          is_system: false
        }
      ]);
    } catch (e) {
      // Local fallback active
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.channelTitle}>{t.communityChat}</Text>
            <Text style={styles.channelSub}>Kantalai Community • 125 {t.communityMembers || 'members'}</Text>
          </View>
        </View>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>👥</Text>
        </View>
      </View>

      {/* Messages Scroll Feed */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((item) => {
          if (item.is_system) {
            return (
              <View key={item.id} style={styles.systemMsgContainer}>
                <View style={styles.systemBadge}>
                  <Text style={styles.systemIcon}>ℹ️</Text>
                  <Text style={styles.systemText}>{item.message}</Text>
                </View>
              </View>
            );
          }

          const isMe = item.sender_name === 'You';
          return (
            <View
              key={item.id}
              style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}
            >
              {!isMe && (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{item.sender_name.charAt(0)}</Text>
                </View>
              )}

              <View
                style={[
                  styles.msgBubble,
                  isMe ? styles.bubbleMe : styles.bubbleOther
                ]}
              >
                {!isMe && (
                  <Text style={styles.senderName}>{item.sender_name}</Text>
                )}

                {item.photo_url && (
                  <Image source={{ uri: item.photo_url }} style={styles.chatImage} />
                )}

                <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
                  {item.message}
                </Text>
                <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                  {item.time}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t.typeMessage || 'Type a message...'}
          placeholderTextColor="#94A3B8"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 10, padding: 4 },
  backArrow: { fontSize: 22, color: '#1E293B', fontWeight: '700' },
  channelTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  channelSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  groupAvatarText: { fontSize: 16 },

  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },

  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgRowMe: { justifyContent: 'flex-end' },

  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  msgBubble: {
    maxWidth: '75%',
    borderRadius: 14,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 2
  },
  bubbleMe: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 2
  },
  senderName: { fontSize: 11, fontWeight: '700', color: '#2563EB', marginBottom: 4 },
  chatImage: { width: 200, height: 110, borderRadius: 8, marginBottom: 6 },
  msgText: { fontSize: 13, color: '#1E293B', lineHeight: 18 },
  msgTextMe: { color: '#FFFFFF' },
  msgTime: { fontSize: 9, color: '#94A3B8', marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: '#BFDBFE' },

  systemMsgContainer: { alignItems: 'center', marginVertical: 10 },
  systemBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  systemIcon: { fontSize: 12 },
  systemText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: '#0F172A'
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendIcon: { color: '#FFFFFF', fontSize: 16, marginLeft: 2 }
});
