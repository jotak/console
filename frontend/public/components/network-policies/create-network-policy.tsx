import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { getActiveNamespace } from '../../actions/ui';
import { NetworkPolicy } from './network-policy-model';
import { NetworkPolicyForm } from './network-policy-form';

export const CreateNetworkPolicy: React.FunctionComponent<{}> = () => {
  const { t } = useTranslation();
  const emptyPolicy: NetworkPolicy = {
    name: '',
    namespace: getActiveNamespace(),
    podSelector: [['', '']],
    ingress: {
      denyAll: false,
      rules: [],
    },
    egress: {
      denyAll: false,
      rules: [],
    },
  };
  const [networkPolicy, setNetworkPolicy] = React.useState(emptyPolicy);

  return (
    <div className="co-m-pane__body co-m-pane__form">
      <h1 className="co-m-pane__heading co-m-pane__heading--baseline">
        <div className="co-m-pane__name">{t('public~Create NetworkPolicy')}</div>
        <div className="co-m-pane__heading-link">
          <Link
            to={`/k8s/ns/${networkPolicy.namespace}/networkpolicies/~new`}
            id="yaml-link"
            data-test="yaml-link"
            replace
          >
            {t('public~Edit YAML')}
          </Link>
        </div>
      </h1>
      <p className="co-m-pane__explanation">
        {t(
          'public~NetworkPolicy can specify how Pods are allowed to communicate with various network entities.',
        )}
      </p>
      <NetworkPolicyForm networkPolicy={networkPolicy} setNetworkPolicy={setNetworkPolicy} />
    </div>
  );
};
