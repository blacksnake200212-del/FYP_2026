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
  Platform,
  ActivityIndicator
} from 'react-native';
import { supabase } from './supabaseClient';
import { ChatBubbleIcon } from './Icons';

export default function CommunityChatScreen({ t, onBack }) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef();

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('community_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (!error && data) {
        const mapped = data.map((d) => ({
          id: String(d.id),
          sender_name: d.sender_name || 'Neighbor',
          sender_role: d.sender_role || 'CITIZEN',
          message: d.message,
          photo_url: d.photo_url || null,
          time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          is_system: d.is_system || false
        }));
        setMessages(mapped);
      }
    } catch (err) {
      console.warn('Chat load err:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    // Subscribe to realtime incoming chat messages
    const channel = supabase
      .channel('public-chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages' },
        (payload) => {
          if (payload.new) {
            const d = payload.new;
            setMessages((prev) => [
              ...prev,
              {
                id: String(d.id),
                sender_name: d.sender_name || 'Neighbor',
                sender_role: d.sender_role || 'CITIZEN',
                message: d.message,
                photo_url: d.photo_url || null,
                time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_system: d.is_system || false
              }
            ]);
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText('');

    const tempId = 'local-' + Date.now();
    const newMsg = {
      id: tempId,
      sender_name: 'You',
      sender_role: 'CITIZEN',
      message: text,
      photo_url: null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_system: false
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      await supabase.from('community_messages').insert([
        {
          dam_id: 'KANTALAI-01',
          sender_name: 'Community Member',
          sender_role: 'CITIZEN',
          message: text,
          is_system: false
        }
      ]);
    } catch (e) {
      console.warn('Remote chat insert err:', e);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
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
            <Text style={styles.channelTitle}>{t.communityChat || 'Community Discussion'}</Text>
            <Text style={styles.channelSub}>Kantalai Reservoir Community Channel</Text>
          </View>
        </View>
        <ChatBubbleIcon size={24} color="#2563EB" />
      </View>

      {/* Messages Scroll Feed */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Loading community discussion...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ChatBubbleIcon size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Messages Yet</Text>
            <Text style={styles.emptySub}>
              Be the first to post a message or question regarding local weather, water levels, or road conditions.
            </Text>
          </View>
        ) : (
          messages.map((item) => {
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
                    <Image source={{ uri: item.photo_url }} style={styles.chatImage} resizeMode="cover" />
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
          })
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t.typeMessage || 'Type a message to community...'}
          placeholderTextColor="#94A3B8"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          editable={!isSending}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isSending}>
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
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

  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },

  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: '#64748B', fontSize: 12, marginTop: 8 },

  emptyContainer: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748B', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4, lineHeight: 18 },

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
    maxWidth: '78%',
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
