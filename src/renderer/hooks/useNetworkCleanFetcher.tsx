import {useCallback, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';
import axios from 'axios';

import {getCleanSockets} from '@renderer/selectors';
import {toggleCleanProcess} from '@renderer/store/sockets';
import {AppDispatch, CleanStatus, ManagedNode, NodeCleanStatusWithAddress, ProtocolType} from '@renderer/types';
import {generateUuid} from '@renderer/utils/local';
import {displayToast} from '@renderer/utils/toast';
import {formatAddress} from '@renderer/utils/address';

import useAddress from './useAddress';

const useNetworkCleanFetcher = (
  managedBank: ManagedNode | undefined,
  isAuthenticated: boolean,
): {
  cleanLastCompleted: string;
  cleanStatus: CleanStatus | null;
  handleCleanClick: () => Promise<void>;
  loadingClean: boolean;
  submittingClean: boolean;
} => {
  const {ipAddress, port: portStr, protocol} = useParams<{ipAddress: string; port: string; protocol: ProtocolType}>();
  const port = portStr === '80' || !portStr.length ? null : parseInt(portStr, 10);
  const address = useAddress();
  const dispatch = useDispatch<AppDispatch>();
  const cleanSockets = useSelector(getCleanSockets);
  const [cleanLastCompleted, setCleanLastCompleted] = useState<string>('');
  const [cleanStatus, setCleanStatus] = useState<CleanStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const socketEntry = Object.entries(cleanSockets).find(
    (e) => formatAddress(e[1].ip_address, e[1].port, e[1].protocol) === address,
  );
  const cleanSocket = socketEntry ? cleanSockets[socketEntry[0]] : null;

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        const {data} = await axios.get<NodeCleanStatusWithAddress>(`${address}/clean`);
        setCleanStatus(data.clean_status);
        setCleanLastCompleted(data.clean_last_completed);
      } catch (error) {
        displayToast('An error occurred when getting clean status');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [address, isAuthenticated]);

  useEffect(() => {
    if (!cleanSocket) return;
    if (cleanSocket.clean_status !== cleanStatus) {
      setCleanStatus(cleanSocket.clean_status);
      setCleanLastCompleted(cleanSocket.clean_last_completed);
    }
  }, [cleanSocket, cleanSocket?.clean_status, cleanStatus]);

  const handleClick = useCallback(async (): Promise<void> => {
    if (!managedBank?.account_signing_key) return;

    setSubmitting(true);
    if (cleanStatus === CleanStatus.notCleaning || cleanStatus === CleanStatus.cleaning) {
      const id = (socketEntry && socketEntry[0]) || generateUuid();
      dispatch(
        toggleCleanProcess({
          cleanStatus,
          id,
          ip_address: ipAddress,
          port,
          protocol,
          signingKey: managedBank.nid_signing_key,
        }),
      );
    }
    setSubmitting(false);
  }, [
    cleanStatus,
    dispatch,
    ipAddress,
    managedBank?.account_signing_key,
    managedBank?.nid_signing_key,
    port,
    protocol,
    socketEntry,
  ]);

  return {
    cleanLastCompleted,
    cleanStatus,
    handleCleanClick: handleClick,
    loadingClean: loading,
    submittingClean: submitting,
  };
};

export default useNetworkCleanFetcher;
