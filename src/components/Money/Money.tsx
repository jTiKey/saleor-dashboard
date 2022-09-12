import useLocale from "@saleor/hooks/useLocale";
import { makeStyles } from "@saleor/macaw-ui";
import { getMoneyFormatted, IMoney } from "@saleor/utils/intl";
import React from "react";

const useStyles = makeStyles(
  {
    currency: {
      fontSize: "0.875em",
      marginRight: "0.5rem",
    },
  },
  { name: "Money" },
);

export interface MoneyProps {
  money: IMoney | null;
}

export const Money: React.FC<MoneyProps> = ({ money }) => {
  const { locale } = useLocale();
  const classes = useStyles();

  if (!money) {
    return null;
  }

  const amount = getMoneyFormatted(locale, money);

  return (
    <>
      <span className={classes.currency}>{money.currency}</span>
      {amount}
    </>
  );
};

Money.displayName = "Money";
export default Money;
