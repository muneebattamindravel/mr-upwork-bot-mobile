import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { playgroundQuery } from '../../apis/playground';

export default function PlaygroundScreen() {
  // The brain searches across ALL approved projects automatically — no
  // profile selector is needed (and the /playground/profiles endpoint no
  // longer exists). We just open straight into the chat.
  const [messages, setMessages] = useState([]); // [{role, content, context?}]
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contextOpen, setContextOpen] = useState(null); // index of msg whose context is shown
  const scrollRef = useRef(null);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const newMsg = { role: 'user', content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((p) => [...p, newMsg]);
    setInput('');
    setSending(true);
    try {
      const res = await playgroundQuery({ message: text, history });
      const reply = res?.reply || res?.message || '(no reply)';
      const context = res?.context || res?.contextProjects || [];
      setMessages((p) => [...p, { role: 'assistant', content: reply, context }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Query failed.');
      setMessages((p) => [...p, { role: 'assistant', content: '⚠️ Error generating response.' }]);
    } finally {
      setSending(false);
    }
  };

  const copy = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Response copied to clipboard.');
  };

  const clearChat = () => {
    Alert.alert('Clear chat?', 'This deletes the current conversation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header — title + clear */}
      <View style={styles.topBar}>
        <View style={styles.chipsRow}>
          <Text style={styles.headerTitle}>BD Playground</Text>
          <Text style={styles.muted}>Grounded in all approved portfolio projects</Text>
        </View>
        {messages.length > 0 ? (
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flask-outline" size={48} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>BD Playground</Text>
              <Text style={styles.emptyDesc}>
                Ask anything about your past projects, capabilities, or proposal strategy. Responses are
                grounded in your approved portfolio.
              </Text>
            </View>
          ) : (
            messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <View key={i} style={[styles.msgRow, isUser ? styles.msgRight : styles.msgLeft]}>
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAssistant]}>
                      {m.content}
                    </Text>
                  </View>
                  {!isUser ? (
                    <View style={styles.msgActions}>
                      <TouchableOpacity onPress={() => copy(m.content)} style={styles.actionBtn}>
                        <Ionicons name="copy-outline" size={13} color={COLORS.muted} />
                        <Text style={styles.actionText}>Copy</Text>
                      </TouchableOpacity>
                      {Array.isArray(m.context) && m.context.length > 0 ? (
                        <TouchableOpacity onPress={() => setContextOpen(i)} style={styles.actionBtn}>
                          <Ionicons name="library-outline" size={13} color={COLORS.muted} />
                          <Text style={styles.actionText}>{m.context.length} sources</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          {sending ? (
            <View style={[styles.msgRow, styles.msgLeft]}>
              <View style={[styles.bubble, styles.bubbleAssistant, { paddingVertical: 12 }]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your portfolio..."
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Context modal */}
      <Modal
        visible={contextOpen != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setContextOpen(null)}
      >
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sources Used</Text>
            <TouchableOpacity onPress={() => setContextOpen(null)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14 }}>
            {(messages[contextOpen]?.context || []).map((c, i) => (
              <View key={i} style={styles.sourceCard}>
                <Text style={styles.sourceTitle}>{c.title || c.projectTitle || `Source ${i + 1}`}</Text>
                {c.score != null ? (
                  <Text style={styles.sourceScore}>
                    Match: {(c.score * 100).toFixed(1)}%
                  </Text>
                ) : null}
                {c.text || c.snippet ? (
                  <Text style={styles.sourceSnippet}>
                    {(c.text || c.snippet).slice(0, 600)}
                    {(c.text || c.snippet).length > 600 ? '...' : ''}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 2, flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: COLORS.primary },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  muted: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic', paddingHorizontal: 12 },

  chatScroll: { padding: 12, paddingBottom: 20 },
  emptyState: { alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },

  msgRow: { marginBottom: 10, maxWidth: '92%' },
  msgRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextUser: { color: '#fff' },
  msgTextAssistant: { color: COLORS.textPrimary },
  msgActions: { flexDirection: 'row', gap: 12, marginTop: 4, paddingHorizontal: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputField: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    maxHeight: 120,
    minHeight: 40,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  sourceCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  sourceScore: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginBottom: 6 },
  sourceSnippet: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
});
