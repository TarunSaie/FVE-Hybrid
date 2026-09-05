import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/constants/colors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FitVerse Elite ErrorBoundary caught runtime crash:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>FITVERSE ELITE</Text>
            <Text style={styles.subtitle}>RUNTIME RECOVERY</Text>
            <View style={styles.divider} />
            <Text style={styles.message}>
              An unexpected error occurred while running the application.
            </Text>
            {this.state.error && (
              <ScrollView style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {this.state.error.name}: {this.state.error.message}
                </Text>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.button} onPress={this.handleRestart} activeOpacity={0.8}>
              <Text style={styles.buttonText}>RESTART APP</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#121212',
    borderColor: 'rgba(239, 161, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 4,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: colors.gold,
    marginVertical: 16,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  errorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#050505',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
});
