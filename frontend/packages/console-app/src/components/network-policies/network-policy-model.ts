import { TFunction } from 'i18next';
import * as _ from 'lodash';
import {
  NetworkPolicyKind,
  NetworkPolicyPort as K8SPort,
  NetworkPolicyPeer as K8SPeer,
  Selector,
} from '@console/internal/module/k8s';

// Reference: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#networkpolicyspec-v1-networking-k8s-io

export interface NetworkPolicy {
  name: string;
  namespace: string;
  podSelector: string[][];
  ingress: NetworkPolicyRules;
  egress: NetworkPolicyRules;
}

export interface NetworkPolicyRules {
  rules: NetworkPolicyRule[];
  denyAll: boolean;
}

export interface NetworkPolicyRule {
  key: string;
  peers: NetworkPolicyPeer[];
  ports: NetworkPolicyPort[];
}

export interface NetworkPolicyPeer {
  key: string;
  podSelector?: string[][];
  namespaceSelector?: string[][];
  ipBlock?: NetworkPolicyIPBlock;
}

export interface NetworkPolicyIPBlock {
  cidr: string;
  except: { key: string; value: string }[];
}

export type NetworkPolicyPort = {
  key: string;
  protocol: string;
  port: string;
};

const networkPolicyTypeIngress = 'Ingress';
const networkPolicyTypeEgress = 'Egress';

interface ConversionError {
  kind: 'invalid' | 'unsupported';
  error: string;
}

const isError = <T>(result: T | ConversionError): result is ConversionError => {
  return result && (result as ConversionError).error !== undefined;
};
export const isNetworkPolicyConversionError = isError;

const factorOutError = <T>(list: (T | ConversionError)[]): T[] | ConversionError => {
  const err = list.find((r) => isError(r)) as ConversionError | undefined;
  if (err) {
    return err;
  }
  return list as T[];
};

const errors = {
  isMissing: (t: TFunction, path: string): ConversionError => ({
    kind: 'invalid',
    error: t('public~{{path}} is missing.', { path }),
  }),
  shouldBeAnArray: (t: TFunction, path: string): ConversionError => ({
    kind: 'invalid',
    error: t('public~{{path}} should be an Array.', { path }),
  }),
  shouldNotBeEmpty: (t: TFunction, path: string): ConversionError => ({
    kind: 'invalid',
    error: t('public~{{path}} should not be empty.', { path }),
  }),
  notSupported: (t: TFunction, path: string): ConversionError => ({
    kind: 'unsupported',
    error: t('public~{{path}} found in resource, but is not supported in form.', { path }),
  }),
};

const selectorToK8s = <T>(
  selector: string[][],
  emptyValue: Selector | undefined,
  t: TFunction,
): Selector | undefined | ConversionError => {
  const filtered = selector.filter((pair) => pair.length >= 2 && pair[0] !== '');
  if (filtered.length > 0) {
    const obj = _.fromPairs(filtered);
    if (Object.keys(obj).length !== filtered.length) {
      return { kind: 'invalid', error: t('public~Duplicate keys found in label selector') };
    }
    return {
      matchLabels: obj,
    };
  }
  return emptyValue;
};

type Rule = { from?: K8SPeer[]; to?: K8SPeer[]; ports?: K8SPort[] };

const ruleToK8s = (
  rule: NetworkPolicyRule,
  direction: 'ingress' | 'egress',
  t: TFunction,
): Rule | ConversionError => {
  const res: Rule = {};
  if (rule.peers.length > 0) {
    const peers = factorOutError(
      rule.peers.map((p) => {
        const peer: K8SPeer = {};
        if (p.ipBlock) {
          peer.ipBlock = {
            cidr: p.ipBlock.cidr,
            ...(p.ipBlock.except && { except: p.ipBlock.except.map((e) => e.value) }),
          };
        } else {
          if (p.podSelector) {
            const sel = selectorToK8s(p.podSelector, {}, t);
            if (isError(sel)) {
              return sel;
            }
            peer.podSelector = sel;
          }
          if (p.namespaceSelector) {
            const sel = selectorToK8s(p.namespaceSelector, {}, t);
            if (isError(sel)) {
              return sel;
            }
            peer.namespaceSelector = sel;
          }
        }
        return peer;
      }),
    );
    if (isError(peers)) {
      return peers;
    }
    if (direction === 'ingress') {
      res.from = peers;
    } else {
      res.to = peers;
    }
  }
  if (rule.ports.length > 0) {
    res.ports = rule.ports.map((p) => ({
      protocol: p.protocol,
      port: Number.isNaN(Number(p.port)) ? p.port : Number(p.port),
    }));
  }
  return res;
};

export const networkPolicyToK8sResource = (
  from: NetworkPolicy,
  t: TFunction,
): NetworkPolicyKind | ConversionError => {
  const podSelector = selectorToK8s(from.podSelector, null, t);
  if (isError(podSelector)) {
    return podSelector;
  }

  const res: NetworkPolicyKind = {
    kind: 'NetworkPolicy',
    apiVersion: 'networking.k8s.io/v1',
    metadata: {
      name: from.name,
      namespace: from.namespace,
    },
    spec: {
      podSelector,
      policyTypes: [],
    },
  };
  if (from.ingress.denyAll) {
    res.spec.policyTypes.push(networkPolicyTypeIngress);
    res.spec.ingress = [];
  } else if (from.ingress.rules.length > 0) {
    res.spec.policyTypes.push(networkPolicyTypeIngress);
    const rules = factorOutError(from.ingress.rules.map((r) => ruleToK8s(r, 'ingress', t)));
    if (isError(rules)) {
      return rules;
    }
    res.spec.ingress = rules;
  }
  if (from.egress.denyAll) {
    res.spec.policyTypes.push(networkPolicyTypeEgress);
    res.spec.egress = [];
  } else if (from.egress.rules.length > 0) {
    res.spec.policyTypes.push(networkPolicyTypeEgress);
    const rules = factorOutError(from.egress.rules.map((r) => ruleToK8s(r, 'egress', t)));
    if (isError(rules)) {
      return rules;
    }
    res.spec.egress = rules;
  }
  return res;
};

export const networkPolicyNormalizeK8sResource = (from: NetworkPolicyKind): NetworkPolicyKind => {
  // This normalization is performed in order to make sure that converting from and to k8s back and forth remains consistent
  const clone = _.cloneDeep(from);
  if (clone.spec) {
    if (clone.spec.podSelector && _.isEmpty(clone.spec.podSelector)) {
      clone.spec.podSelector = null;
    }
    if (!_.has(clone.spec, 'policyTypes')) {
      clone.spec.policyTypes = [networkPolicyTypeIngress];
      if (_.has(clone.spec, 'egress')) {
        clone.spec.policyTypes.push(networkPolicyTypeEgress);
      }
    }
    if (
      !_.has(clone.spec, 'ingress') &&
      clone.spec.policyTypes.includes(networkPolicyTypeIngress)
    ) {
      clone.spec.ingress = [];
    }
  }
  return clone;
};

const selectorFromK8s = (selector: Selector): string[][] | ConversionError => {
  if (!selector) {
    return [];
  }
  // if (!_.isEmpty(selector.matchExpressions)) {
  //   return errors.notSupported(t, `${path}.matchExpressions`);
  // }
  const matchLabels = selector.matchLabels || {};
  return _.isEmpty(matchLabels) ? [] : _.map(matchLabels, (key: string, val: string) => [val, key]);
};

const portFromK8s = (port: K8SPort): NetworkPolicyPort | ConversionError => {
  // if (_.has(port, 'endPort')) {
  //   return errors.notSupported(t, `${path}.endPort`);
  // }
  return {
    key: _.uniqueId('port-'),
    protocol: port.protocol || 'TCP',
    port: port.port ? String(port.port) : '',
  };
};

const ipblockFromK8s = (
  ipblock: { cidr: string; except?: string[] },
  path: string,
  t: TFunction,
): NetworkPolicyIPBlock | ConversionError => {
  const res: NetworkPolicyIPBlock = {
    cidr: ipblock.cidr || '',
    except: [],
  };
  if (_.has(ipblock, 'except')) {
    if (!_.isArray(ipblock.except)) {
      return errors.shouldBeAnArray(t, `${path}.except`);
    }
    res.except = ipblock.except
      ? ipblock.except.map((e) => ({ key: _.uniqueId('exception-'), value: e }))
      : undefined;
  }
  return res;
};

const peerFromK8s = (
  peer: K8SPeer,
  path: string,
  t: TFunction,
): NetworkPolicyPeer | ConversionError => {
  const out: NetworkPolicyPeer = { key: _.uniqueId() };
  if (peer.ipBlock) {
    const ipblock = ipblockFromK8s(peer.ipBlock, `${path}.ipBlock`, t);
    if (isError(ipblock)) {
      return ipblock;
    }
    out.ipBlock = ipblock;
  } else {
    if (peer.podSelector) {
      const podSel = selectorFromK8s(peer.podSelector);
      if (isError(podSel)) {
        return podSel;
      }
      out.podSelector = podSel;
    }
    if (peer.namespaceSelector) {
      const nsSel = selectorFromK8s(peer.namespaceSelector);
      if (isError(nsSel)) {
        return nsSel;
      }
      out.namespaceSelector = nsSel;
    }
  }
  if (!out.ipBlock && !out.namespaceSelector && !out.podSelector) {
    return errors.shouldNotBeEmpty(t, path);
  }
  return out;
};

const ruleFromK8s = (
  rule: Rule,
  path: string,
  peersKey: 'from' | 'to',
  t: TFunction,
): NetworkPolicyRule | ConversionError => {
  const converted: NetworkPolicyRule = {
    key: _.uniqueId(),
    ports: [],
    peers: [],
  };
  if (rule.ports) {
    if (!_.isArray(rule.ports)) {
      return errors.shouldBeAnArray(t, `${path}.ports`);
    }
    const ports = factorOutError(rule.ports.map((p) => portFromK8s(p)));
    if (isError(ports)) {
      return ports;
    }
    converted.ports = ports;
  }
  if (_.has(rule, peersKey)) {
    if (!_.isArray(rule[peersKey])) {
      return errors.shouldBeAnArray(t, `${path}.${peersKey}`);
    }
    const peers = factorOutError(
      rule[peersKey].map((p, idx) => peerFromK8s(p, `${path}.${peersKey}[${idx}]`, t)),
    );
    if (isError(peers)) {
      return peers;
    }
    converted.peers = peers;
  }
  return converted;
};

const rulesFromK8s = (
  rules: Rule[],
  path: string,
  peersKey: 'from' | 'to',
  isAffected: boolean,
  t: TFunction,
): NetworkPolicyRules | ConversionError => {
  if (!isAffected) {
    return { rules: [], denyAll: false };
  }
  // Quoted from doc reference: "If this field is empty then this NetworkPolicy does not allow any traffic"
  if (!rules) {
    return { rules: [], denyAll: true };
  }
  if (!_.isArray(rules)) {
    return errors.shouldBeAnArray(t, path);
  }
  if (rules.length === 0) {
    return { rules: [], denyAll: true };
  }
  const converted = factorOutError(
    rules.map((r, idx) => ruleFromK8s(r, `${path}[${idx}]`, peersKey, t)),
  );
  if (isError(converted)) {
    return converted;
  }
  return { rules: converted, denyAll: false };
};

export const networkPolicyFromK8sResource = (
  from: NetworkPolicyKind,
  t: TFunction,
): NetworkPolicy | ConversionError => {
  if (!from.metadata) {
    return errors.isMissing(t, 'Metadata');
  }
  if (!from.spec) {
    return errors.isMissing(t, 'Spec');
  }
  // per spec, podSelector can be null, but key must be present
  if (!_.has(from.spec, 'podSelector')) {
    return errors.isMissing(t, 'Spec.podSelector');
  }
  const podSelector = selectorFromK8s(from.spec.podSelector);
  if (isError(podSelector)) {
    return podSelector;
  }

  // Note, the logic differs between ingress and egress, see https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#networkpolicyspec-v1-networking-k8s-io
  // A policy affects egress if it is explicitely specified in policyTypes, or if policyTypes isn't set and there is an egress section.
  // A policy affects ingress if it is explicitely specified in policyTypes, or if policyTypes isn't set, regardless the presence of an ingress sections.
  const explicitPolicyTypes = !!from.spec.policyTypes;
  const affectsEgress = explicitPolicyTypes
    ? from.spec.policyTypes.includes(networkPolicyTypeEgress)
    : !!from.spec.egress;
  const affectsIngress = explicitPolicyTypes
    ? from.spec.policyTypes.includes(networkPolicyTypeIngress)
    : true;

  const ingressRules = rulesFromK8s(from.spec.ingress, 'Spec.ingress', 'from', affectsIngress, t);
  if (isError(ingressRules)) {
    return ingressRules;
  }

  const egressRules = rulesFromK8s(from.spec.egress, 'Spec.egress', 'to', affectsEgress, t);
  if (isError(egressRules)) {
    return egressRules;
  }

  return {
    name: from.metadata.name || '',
    namespace: from.metadata.namespace || '',
    podSelector,
    ingress: ingressRules,
    egress: egressRules,
  };
};
