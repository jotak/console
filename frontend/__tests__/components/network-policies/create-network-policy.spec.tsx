import * as React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { Button, FormFieldGroupExpandable } from '@patternfly/react-core';

import { ButtonBar } from '../../../public/components/utils';
import { NetworkPolicy } from '../../../public/components/network-policies/network-policy-model';
import { NetworkPolicyForm } from '../../../public/components/network-policies/network-policy-form';
import { NetworkPolicyRuleConfigPanel } from '../../../public/components/network-policies/network-policy-rule-config';

jest.mock('react-i18next', () => {
  const reactI18next = require.requireActual('react-i18next');
  return {
    ...reactI18next,
    useTranslation: () => ({ t: (key: string) => key }),
    withTranslation: () => (Component) => {
      Component.defaultProps = { ...Component.defaultProps, t: (s) => s };
      return Component;
    },
  };
});

const i18nNS = 'public';
const emptyPolicy: NetworkPolicy = {
  name: '',
  namespace: 'default',
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

describe('NetworkPolicyForm', () => {
  let wrapper: ShallowWrapper<{ networkPolicy: NetworkPolicy }, {}>;

  beforeEach(() => {
    wrapper = shallow(
      <NetworkPolicyForm networkPolicy={emptyPolicy} setNetworkPolicy={() => {}} />,
    );
  });

  it('should render CreateNetworkPolicy component', () => {
    expect(wrapper.exists()).toBe(true);
  });

  it('should render the main form elements of CreateNetworkPolicy component', () => {
    expect(wrapper.find('input[id="name"]')).toHaveLength(1);
    expect(wrapper.find('input[id="namespace"]')).toHaveLength(1);
    expect(wrapper.find(FormFieldGroupExpandable)).toHaveLength(2);
  });

  it('should render control buttons in a button bar with create disabled', () => {
    const buttonBar = wrapper.find(ButtonBar);
    expect(buttonBar.exists()).toBe(true);
    expect(
      buttonBar
        .find(Button)
        .at(0)
        .childAt(0)
        .text(),
    ).toEqual(`${i18nNS}~Create`);
    expect(
      buttonBar
        .find(Button)
        .at(1)
        .childAt(0)
        .text(),
    ).toEqual(`${i18nNS}~Cancel`);
  });

  it('should render multiple rules', () => {
    const networkPolicy = { ...emptyPolicy };
    networkPolicy.ingress = {
      denyAll: false,
      rules: [
        {
          key: '1',
          peers: [],
          ports: [],
        },
        {
          key: '2',
          peers: [],
          ports: [],
        },
      ],
    };
    networkPolicy.egress = {
      denyAll: false,
      rules: [
        {
          key: '3',
          peers: [],
          ports: [],
        },
      ],
    };
    wrapper.setProps({ networkPolicy });
    expect(wrapper.find(NetworkPolicyRuleConfigPanel)).toHaveLength(3);
  });
});
